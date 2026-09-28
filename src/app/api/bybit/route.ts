import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------- Types ----------------

interface BybitContext {
  apiKey: string;
  apiSecret: string;
  isDemo: boolean;
}

// ---------------- Signing (Bybit V5 spec) ----------------
//
// Bybit V5 signature = hex(HMAC-SHA256(
//   timestamp + api_key + recv_window + param_str,
//   secret
// ))
//
// Where param_str is:
//   - For GET/DELETE: query string sorted alphabetically
//   - For POST: the raw JSON body string

function sign(
  timestamp: number,
  apiKey: string,
  recvWindow: number,
  paramStr: string,
  secret: string,
): string {
  const prehash = `${timestamp}${apiKey}${recvWindow}${paramStr}`;
  return crypto.createHmac("sha256", secret).update(prehash, "utf8").digest("hex");
}

function buildParamStr(method: "GET" | "POST" | "DELETE", opts: { query?: Record<string, string>; body?: any }): string {
  if (method === "POST") return opts.body ? JSON.stringify(opts.body) : "";
  // For GET/DELETE — Bybit expects the query string in the SAME order it
  // appears in the URL. We pass already-built query strings, so we just
  // return it as-is. Caller is responsible for sorting alphabetically.
  if (opts.query) {
    return Object.entries(opts.query)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
  }
  return "";
}

// ---------------- Bybit call ----------------

async function callBybit<T = any>(
  ctx: BybitContext,
  method: "GET" | "POST" | "DELETE",
  path: string,
  opts: { query?: Record<string, string>; body?: any } = {},
): Promise<{ status: number; json: T }> {
  const baseHost = ctx.isDemo ? "api-testnet.bybit.com" : "api.bybit.com";
  const paramStr = buildParamStr(method, opts);
  const fullPath = `${path}${opts.query ? `?${paramStr}` : ""}`;
  const url = `https://${baseHost}${fullPath}`;
  const timestamp = Date.now();
  const recvWindow = 5000;
  const signature = sign(timestamp, ctx.apiKey, recvWindow, paramStr, ctx.apiSecret);

  const headers: Record<string, string> = {
    "X-BAPI-API-KEY": ctx.apiKey,
    "X-BAPI-SIGN": signature,
    "X-BAPI-TIMESTAMP": String(timestamp),
    "X-BAPI-RECV-WINDOW": String(recvWindow),
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: method === "POST" && opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      redirect: "error",
    });
  } catch (err: any) {
    return {
      status: 502,
      json: { retCode: -1, retMsg: `Network error: ${err?.message ?? err}` } as T,
    };
  }
  const json = (await res.json().catch(() => ({})) as T);
  return { status: res.status, json };
}

// ---------------- Auto-detect environment ----------------

async function probeEnvironment(
  apiKey: string,
  apiSecret: string,
): Promise<
  | { environment: "demo" | "live"; accountBalance: any; balance: any }
  | { environment: "unknown"; error: string; demoError: any; liveError: any }
> {
  // Try testnet first
  const demoRes = await callBybit(
    { apiKey, apiSecret, isDemo: true },
    "GET",
    "/v5/account/wallet-balance",
    { query: { accountType: "UNIFIED" } },
  );
  const demoErr = {
    status: demoRes.status,
    code: (demoRes.json as any)?.retCode,
    msg: (demoRes.json as any)?.retMsg,
  };
  if (demoRes.status === 200 && (demoRes.json as any)?.retCode === 0) {
    const account = (demoRes.json as any)?.result?.list?.[0];
    return {
      environment: "demo",
      accountBalance: account,
      balance: flattenBalance(account),
    };
  }
  // Try mainnet
  const liveRes = await callBybit(
    { apiKey, apiSecret, isDemo: false },
    "GET",
    "/v5/account/wallet-balance",
    { query: { accountType: "UNIFIED" } },
  );
  const liveErr = {
    status: liveRes.status,
    code: (liveRes.json as any)?.retCode,
    msg: (liveRes.json as any)?.retMsg,
  };
  if (liveRes.status === 200 && (liveRes.json as any)?.retCode === 0) {
    const account = (liveRes.json as any)?.result?.list?.[0];
    return {
      environment: "live",
      accountBalance: account,
      balance: flattenBalance(account),
    };
  }
  return {
    environment: "unknown",
    error: liveErr.msg || demoErr.msg || `HTTP ${liveRes.status}`,
    demoError: demoErr,
    liveError: liveErr,
  };
}

// ---------------- Helpers to parse Bybit balance ----------------

function flattenBalance(data: any) {
  // Bybit GET /v5/account/wallet-balance returns:
  // { retCode: 0, result: { list: [{ accountType, totalEquity, ... , coin: [{ coin, equity, availableToWithdraw }] }] } }
  if (!data?.coin) return null;
  let totalUsd = parseFloat(data.totalEquity ?? "0");
  const balances: { ccy: string; total: number; available: number }[] = [];
  for (const c of data.coin) {
    const ccy: string = c.coin;
    const eq: number = parseFloat(c.equity ?? "0");
    const avail: number = parseFloat(c.availableToWithdraw ?? c.walletBalance ?? "0");
    if (eq > 0) {
      balances.push({ ccy, total: eq, available: avail });
    }
  }
  return {
    totalEqUsd: totalUsd,
    uplUsd: parseFloat(data.upl ?? "0"),
    uplRatio: 0,
    details: balances,
  };
}

// ---------------- Diagnostic helper ----------------

function diagnoseBybitError(
  demoErr: any,
  liveErr: any,
): { title: string; hint: string } {
  const e = liveErr?.msg ? liveErr : demoErr;
  const code = e?.code;
  const rawMsg = (e?.msg ?? "").toLowerCase();

  // Empty 401 response — usually Cloudflare or a missing-WWW-Authenticate
  // header issue. Bybit's V5 API sometimes returns 401 with no body when
  // the auth headers are missing or malformed.
  if (!rawMsg && (liveErr?.status === 401 || demoErr?.status === 401)) {
    return {
      title: "Bybit rejected the auth headers",
      hint:
        "Bybit returned 401 with no error body — usually means the API " +
        "key format is wrong (too short), or the headers aren't reaching " +
        "Bybit at all (proxy stripping them, or DNS issue). Verify your " +
        "API key is at least 20 characters and the secret is 30+ chars. " +
        "Re-copy both from Bybit → API Management.",
    };
  }
  if (rawMsg.includes("api key not valid") || rawMsg.includes("invalid api key") || code === 10001) {
    return {
      title: "Bybit API key not recognized",
      hint:
        "Bybit rejected the API key. Re-copy it from Bybit → API Management. " +
        "Demo (testnet) and live API keys are SEPARATE — verify you're " +
        "using the right one for the right environment.",
    };
  }
  if (rawMsg.includes("sign") && rawMsg.includes("invalid")) {
    return {
      title: "Signature rejected by Bybit",
      hint:
        "The HMAC-SHA256 signature didn't match. Re-copy the API SECRET from " +
        "Bybit → API Management (no trailing spaces).",
    };
  }
  if (rawMsg.includes("timestamp")) {
    return {
      title: "Clock skew — server timestamp too old",
      hint:
        "Bybit rejects requests where the timestamp differs from server time " +
        "by more than the recv_window (5s). Sync your system clock and retry.",
    };
  }
  if (rawMsg.includes("ip") && (rawMsg.includes("restrict") || rawMsg.includes("forbidden") || rawMsg.includes("whitelist"))) {
    return {
      title: "IP not on Bybit allowlist",
      hint:
        "Your Bybit API key has an IP restriction. Either set the key to allow " +
        "ANY IP in Bybit → API Management, or add this server's outbound IP " +
        "to the allowlist.",
    };
  }
  if (rawMsg.includes("permission") || rawMsg.includes("no permission")) {
    return {
      title: "API key lacks required permissions",
      hint:
        "Bybit rejected because the API key doesn't have the required scope. " +
        "Edit the key in Bybit → API Management → enable 'Read-Write' and " +
        "'Spot Trade' (or 'Futures Trade' depending on what you want to trade).",
    };
  }
  if (rawMsg.includes("network") || rawMsg.includes("enotfound") || rawMsg.includes("fetch failed")) {
    return {
      title: "Couldn't reach Bybit",
      hint:
        "The server couldn't resolve or reach Bybit. Check network/DNS. " +
        "If behind a firewall, allow outbound HTTPS to api.bybit.com and " +
        "api-testnet.bybit.com.",
    };
  }
  return {
    title: "Bybit rejected the request",
    hint:
      `Bybit returned HTTP ${e?.status ?? "?"}` +
      (code ? ` with code ${code}` : "") +
      (rawMsg ? `: ${rawMsg}` : ". No error body returned.") +
      " Verify the API key + secret are correct, that you're using a key " +
      "with 'Read' permission minimum, and that your Bybit account isn't " +
      "in a restricted region.",
  };
}

// ---------------- GET handler — auto-probe + convenience paths ----------------

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "probe";

  const apiKey = req.headers.get("x-bybit-key") ?? "";
  const apiSecret = req.headers.get("x-bybit-secret") ?? "";

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      {
        error:
          "Missing credentials. Pass x-bybit-key, x-bybit-secret headers.",
      },
      { status: 400 },
    );
  }

  if (action === "probe") {
    const result = await probeEnvironment(apiKey, apiSecret);
    if (result.environment === "unknown") {
      const helper = diagnoseBybitError(result.demoError, result.liveError);
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
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
    const { status, json } = await callBybit(
      { apiKey, apiSecret, isDemo: env },
      "GET",
      "/v5/account/wallet-balance",
      { query: { accountType: "UNIFIED" } },
    );
    if (status !== 200 || (json as any)?.retCode !== 0) {
      return NextResponse.json(
        { ok: false, error: (json as any)?.retMsg ?? `HTTP ${status}` },
        { status: 502 },
      );
    }
    const account = (json as any)?.result?.list?.[0];
    return NextResponse.json({ ok: true, balance: flattenBalance(account) });
  }

  if (action === "positions") {
    const env = (url.searchParams.get("env") ?? "live") === "demo";
    const { status, json } = await callBybit(
      { apiKey, apiSecret, isDemo: env },
      "GET",
      "/v5/position/list",
      { query: { category: "linear", settleCoin: "USDT" } },
    );
    return NextResponse.json(json, { status });
  }

  if (action === "fills") {
    // Recent spot fills
    const env = (url.searchParams.get("env") ?? "live") === "demo";
    const { status, json } = await callBybit(
      { apiKey, apiSecret, isDemo: env },
      "GET",
      "/v5/execution/list",
      { query: { category: "spot" } },
    );
    return NextResponse.json(json, { status });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
