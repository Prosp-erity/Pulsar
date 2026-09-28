import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------- Types ----------------

interface OkxReqBody {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  /** Force demo (test) environment. If omitted, we probe both. */
  isDemo?: boolean;
  /** Path under /api/v5/... e.g. "/account/balance" */
  path: string;
  /** HTTP method */
  method?: "GET" | "POST" | "DELETE";
  /** Query string (without leading ?) */
  query?: string;
  /** Body for POST/DELETE */
  body?: string;
}

interface OkxContext {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  isDemo: boolean;
}

// ---------------- Signing ----------------

function sign(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string,
  secret: string,
): string {
  // OKX V5 spec: prehash = timestamp + method (upper) + requestPath (with
  // query string) + body. Signature = base64(HMAC-SHA256(prehash, secret)).
  // The secret is used as the raw UTF-8 bytes — NOT as a hex/base64 key.
  const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
  return crypto.createHmac("sha256", secret).update(prehash, "utf8").digest("base64");
}

function isoTimestamp(): string {
  // OKX V5 expects ISO 8601 with millisecond precision, UTC, like
  // "2024-01-01T00:00:00.000Z". Use the actual current milliseconds
  // (NOT zeroed out — the timestamp must match what OKX sees at request
  // arrival, and zeroing can push the signature window > 30s off).
  return new Date().toISOString();
}

// ---------------- OKX call ----------------

async function callOkx<T = any>(
  ctx: OkxContext,
  path: string,
  opts: { method?: "GET" | "POST" | "DELETE"; query?: string; body?: string } = {},
): Promise<{ status: number; json: T; headers: Headers }> {
  const method = opts.method ?? "GET";
  const baseHost = ctx.isDemo ? "simulated-api.okx.com" : "www.okx.com";
  const fullPath = `/api/v5${path}${opts.query ? `?${opts.query}` : ""}`;
  const url = `https://${baseHost}${fullPath}`;
  const body = opts.body ?? "";
  const timestamp = isoTimestamp();
  const signature = sign(timestamp, method, fullPath, body, ctx.apiSecret);

  const headers: Record<string, string> = {
    "OK-ACCESS-KEY": ctx.apiKey,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": ctx.passphrase,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (ctx.isDemo) headers["x-simulated-trading"] = "1";

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body || undefined,
      cache: "no-store",
      redirect: "error",
    });
  } catch (err: any) {
    // Network/DNS failure — return a synthetic 502 so the caller can
    // still process it gracefully instead of throwing.
    return {
      status: 502,
      json: { code: "-1", msg: `Network error reaching OKX: ${err?.message ?? err}` } as T,
      headers: new Headers(),
    };
  }
  const json = (await res.json().catch(() => ({})) as T);
  return { status: res.status, json, headers: res.headers };
}

// ---------------- Auto-detect environment ----------------

/**
 * Probe whether the given credentials are demo or live by trying the demo
 * endpoint first (a live key will be rejected there with a signature
 * error), then trying the live endpoint.
 *
 * Returns either:
 *   - { environment: "demo"|"live", accountBalance, balance }
 *   - { environment: "unknown", error, errorCode, demoError, liveError,
 *       serverIpHint }
 *
 * The `demoError` and `liveError` fields carry the FULL OKX error
 * response so the UI can show users the exact reason (passphrase wrong,
 * IP not whitelisted, demo trading not enabled, etc).
 */
async function probeEnvironment(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
): Promise<
  | {
      environment: "demo" | "live";
      accountBalance: any;
      balance: ReturnType<typeof flattenBalance>;
    }
  | {
      environment: "unknown";
      error: string;
      errorCode?: string;
      demoError: { status: number; code?: string; msg?: string } | null;
      liveError: { status: number; code?: string; msg?: string } | null;
    }
> {
  // Try demo first
  const demoRes = await callOkx(
    { apiKey, apiSecret, passphrase, isDemo: true },
    "/account/balance",
  );
  const demoErr = {
    status: demoRes.status,
    code: (demoRes.json as any)?.code,
    msg: (demoRes.json as any)?.msg,
  };
  if (demoRes.status === 200 && demoRes.json?.code === "0") {
    const accountBalance = demoRes.json.data?.[0];
    return {
      environment: "demo",
      accountBalance,
      balance: flattenBalance(accountBalance),
    };
  }
  // Try live
  const liveRes = await callOkx(
    { apiKey, apiSecret, passphrase, isDemo: false },
    "/account/balance",
  );
  const liveErr = {
    status: liveRes.status,
    code: (liveRes.json as any)?.code,
    msg: (liveRes.json as any)?.msg,
  };
  if (liveRes.status === 200 && liveRes.json?.code === "0") {
    const accountBalance = liveRes.json.data?.[0];
    return {
      environment: "live",
      accountBalance,
      balance: flattenBalance(accountBalance),
    };
  }
  // Both failed — prefer the live endpoint's error message (because the
  // demo endpoint ALWAYS fails for live keys, even with valid creds).
  return {
    environment: "unknown",
    error:
      liveErr.msg ||
      demoErr.msg ||
      `HTTP ${liveRes.status} (live) / ${demoRes.status} (demo)`,
    errorCode: liveErr.code,
    demoError: demoErr,
    liveError: liveErr,
  };
}

// ---------------- Helpers to parse OKX balance ----------------

function flattenBalance(data: any) {
  // OKX GET /api/v5/account/balance returns:
  // { code: "0", data: [{ totalEq, ... , details: [{ ccy, eq, availBal }] }] }
  // OKX returns eq in USD-equivalent already.
  if (!data?.details) return null;
  let totalUsd = 0;
  const balances: { ccy: string; total: number; available: number }[] = [];
  for (const d of data.details) {
    const ccy: string = d.ccy;
    const eq: number = parseFloat(d.eq ?? "0");
    const avail: number = parseFloat(d.availBal || d.cashBal || "0");
    if (eq > 0) {
      totalUsd += eq;
      balances.push({ ccy, total: eq, available: avail });
    }
  }
  return {
    totalEqUsd: parseFloat(data.totalEq ?? String(totalUsd)),
    uplUsd: parseFloat(data.upl ?? "0"),
    uplRatio: parseFloat(data.uplRatio ?? "0"),
    details: balances,
  };
}

// ---------------- POST handler — generic proxy ----------------

export async function POST(req: NextRequest) {
  let body: OkxReqBody;
  try {
    body = (await req.json()) as OkxReqBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.apiKey || !body.apiSecret || !body.passphrase) {
    return NextResponse.json(
      { error: "apiKey, apiSecret and passphrase are required" },
      { status: 400 },
    );
  }
  if (!body.path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const ctx: OkxContext = {
    apiKey: body.apiKey,
    apiSecret: body.apiSecret,
    passphrase: body.passphrase,
    isDemo: !!body.isDemo,
  };

  try {
    const { status, json } = await callOkx(ctx, body.path, {
      method: body.method,
      query: body.query,
      body: body.body,
    });
    return NextResponse.json(json, { status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "fetch_failed" },
      { status: 502 },
    );
  }
}

// ---------------- GET handler — auto-probe + convenience paths ----------------

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "probe";

  // Read creds from headers (kept out of query string / server logs)
  const apiKey = req.headers.get("x-okx-key") ?? "";
  const apiSecret = req.headers.get("x-okx-secret") ?? "";
  const passphrase = req.headers.get("x-okx-passphrase") ?? "";

  if (!apiKey || !apiSecret || !passphrase) {
    return NextResponse.json(
      {
        error:
          "Missing credentials. Pass x-okx-key, x-okx-secret, x-okx-passphrase headers.",
      },
      { status: 400 },
    );
  }

  if (action === "probe") {
    // Auto-detect demo vs live, return environment + balance in one call
    const result = await probeEnvironment(apiKey, apiSecret, passphrase);
    if (result.environment === "unknown") {
      // Build a rich error object so the UI can show users the EXACT
      // reason OKX rejected the request (passphrase wrong, IP not
      // whitelisted, demo trading not enabled, etc).
      const helper = diagnoseOkxError(
        result.demoError,
        result.liveError,
      );
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          errorCode: result.errorCode,
          demoError: result.demoError,
          liveError: result.liveError,
          hint: helper.hint,
          hintTitle: helper.title,
        },
        { status: 401 },
      );
    }
    return NextResponse.json({
      ok: true,
      environment: result.environment,
      balance: result.balance,
    });
  }

  if (action === "balance") {
    const env = (url.searchParams.get("env") ?? "live") === "demo";
    const { status, json } = await callOkx(
      { apiKey, apiSecret, passphrase, isDemo: env },
      "/account/balance",
    );
    if (status !== 200 || (json as any)?.code !== "0") {
      return NextResponse.json(
        { ok: false, error: (json as any)?.msg ?? `HTTP ${status}` },
        { status: 502 },
      );
    }
    const flat = flattenBalance((json as any).data?.[0]);
    return NextResponse.json({ ok: true, balance: flat });
  }

  if (action === "positions") {
    const env = (url.searchParams.get("env") ?? "live") === "demo";
    const { status, json } = await callOkx(
      { apiKey, apiSecret, passphrase, isDemo: env },
      "/account/positions",
    );
    return NextResponse.json(json, { status });
  }

  if (action === "fills") {
    // Recent spot fills (last 7 days, max 100)
    const env = (url.searchParams.get("env") ?? "live") === "demo";
    const before = new Date(Date.now()).toISOString();
    const query = `instType=SPOT&before=${encodeURIComponent(before)}&limit=100`;
    const { status, json } = await callOkx(
      { apiKey, apiSecret, passphrase, isDemo: env },
      "/trade/fills",
      { query },
    );
    return NextResponse.json(json, { status });
  }

  if (action === "orders") {
    const env = (url.searchParams.get("env") ?? "live") === "demo";
    const { status, json } = await callOkx(
      { apiKey, apiSecret, passphrase, isDemo: env },
      "/trade/orders-pending",
      { query: "instType=SPOT" },
    );
    return NextResponse.json(json, { status });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// ---------------- Diagnostic helper ----------------

/**
 * Map OKX error messages to human-friendly hints the user can act on.
 * OKX V5 error code reference: https://www.okx.com/docs-v5/en/#overview-error-code
 */
function diagnoseOkxError(
  demoErr: { status: number; code?: string; msg?: string } | null,
  liveErr: { status: number; code?: string; msg?: string } | null,
): { title: string; hint: string } {
  // Prefer the live endpoint's error (since the demo endpoint always
  // rejects live keys, even with valid creds — its error is misleading).
  const e = liveErr?.msg ? liveErr : demoErr;
  const code = e?.code;
  const rawMsg = e?.msg ?? "";
  const msg = rawMsg.toLowerCase();

  // IP forbidden / not whitelisted
  if (msg.includes("ip") && (msg.includes("forbidden") || msg.includes("whitelist") || msg.includes("not allowed"))) {
    return {
      title: "IP not on the OKX allowlist",
      hint:
        "OKX sees your SERVER's outbound IP (where this app is running), " +
        "not your local machine's IP. Even if you've allowed all IPs on the " +
        "OKX web UI, the API request still includes the X-Forwarded-For " +
        "header from any proxy. Two fixes: (a) in OKX → API Management → " +
        "edit the API key → set IP restriction to 'No limit'; or " +
        "(b) add this server's IP to the allowlist. Also check your proxy " +
        "isn't stripping the OKX-signed headers.",
    };
  }
  // Demo trading not enabled
  if (msg.includes("demo") && (msg.includes("not") || msg.includes("no registration") || msg.includes("required"))) {
    return {
      title: "Demo trading not enabled on this OKX account",
      hint:
        "Log in to OKX → Profile → Demo Trading → Open Demo Account. " +
        "OKX creates a SEPARATE set of API keys + passphrase for demo " +
        "trading. Your live (production) API key won't work on the demo " +
        "endpoint. Use those demo-only credentials in this app, then retry.",
    };
  }
  // Invalid signature
  if (msg.includes("invalid sign") || msg.includes("signature")) {
    return {
      title: "Signature rejected by OKX",
      hint:
        "OKX received the request but the HMAC-SHA256 signature didn't match. " +
        "Most common cause: the API SECRET has extra whitespace or a copy-paste " +
        "error. Re-copy the secret from OKX → API Management → your key → " +
        "Copy Secret. Make sure you use the secret that MATCHES the API key — " +
        "demo and live keys have separate secrets.",
    };
  }
  // Timestamp expired
  if (msg.includes("timestamp") || msg.includes("expired")) {
    return {
      title: "Clock skew — server timestamp too old",
      hint:
        "OKX rejects requests where the timestamp differs from server time by " +
        "more than 30 seconds. Sync your system clock (e.g. `sudo ntpdate -b " +
        "pool.ntp.org` or `systemctl restart systemd-timesyncd`) and retry.",
    };
  }
  // Invalid passphrase
  if (msg.includes("passphrase")) {
    return {
      title: "Passphrase doesn't match the API key",
      hint:
        "OKX rejected the passphrase you entered. The passphrase is the one " +
        "you set when you CREATED the API key (not your OKX login password). " +
        "Demo and live API keys have SEPARATE passphrases — verify you're " +
        "using the right one for the right key. Case-sensitive.",
    };
  }
  // API key not recognized / invalid ok-access-key
  if (msg.includes("invalid ok-access-key") || msg.includes("no registration record") || code === "50012") {
    return {
      title: "API key not recognized by OKX",
      hint:
        "OKX received the request but doesn't recognize this API key on this " +
        "endpoint. If you're using a DEMO key, make sure you copied it from " +
        "OKX → Demo Trading → API (NOT from production API Management). " +
        "Demo and live environments use completely separate keys. Re-copy " +
        "the API key from OKX and paste it into the Live tab, then retry.",
    };
  }
  // Network / DNS
  if (msg.includes("network error") || msg.includes("enotfound") || msg.includes("fetch failed")) {
    return {
      title: "Couldn't reach OKX",
      hint:
        "The server couldn't resolve or reach OKX. Check your network " +
        "connection and DNS. If you're behind a firewall or in a sandbox, " +
        "allow outbound HTTPS to www.okx.com and simulated-api.okx.com.",
    };
  }
  return {
    title: "OKX rejected the request",
    hint:
      `OKX error code: ${code ?? "?"}. Message: ${rawMsg}. ` +
      "Common fixes: (1) verify the API key, secret, and passphrase are " +
      "copied correctly from OKX API Management; (2) make sure your OKX " +
      "account has demo trading enabled if you're using a demo key; " +
      "(3) demo and live keys are separate — don't mix them.",
  };
}


