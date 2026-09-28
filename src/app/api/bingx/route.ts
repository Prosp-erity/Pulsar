import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------- Types ----------------

interface BingxContext {
  apiKey: string;
  apiSecret: string;
  isDemo: boolean;
}

// ---------------- Signing (BingX V2 spec) ----------------
//
// BingX V2 signature:
//   signature = hex(HMAC-SHA256(paramStr + "&timestamp=" + ts + "&recvWindow=" + recvWindow, secret))
// Where paramStr is the sorted query string (without the leading ?).
// For POST: the body is JSON and goes into the signature prehash too.
//
// Auth headers:
//   X-BX-APIKEY: apiKey
//   X-BX-SIGNATURE: signature
//   X-BX-TIMESTAMP: timestamp

function sign(paramStr: string, ts: number, recvWindow: number, secret: string): string {
  // For GET: the prehash is paramStr + "&timestamp=" + ts + "&recvWindow=" + recvWindow
  // If paramStr is empty, just timestamp + recvWindow.
  const prehash = paramStr
    ? `${paramStr}&timestamp=${ts}&recvWindow=${recvWindow}`
    : `timestamp=${ts}&recvWindow=${recvWindow}`;
  return crypto.createHmac("sha256", secret).update(prehash, "utf8").digest("hex");
}

async function callBingx<T = any>(
  ctx: BingxContext,
  method: "GET" | "POST" | "DELETE",
  path: string,
  opts: { params?: Record<string, string>; body?: any } = {},
): Promise<{ status: number; json: T }> {
  // BingX uses different hostnames for mainnet vs testnet.
  //   Mainnet: https://api.bingx.com
  //   Testnet (swap): https://open-api-swap-testnet.bingx.com
  // For spot endpoints we always hit api.bingx.com — BingX has a single
  // spot endpoint that accepts both live and demo keys (distinguishing
  // by the API key itself).
  const baseHost = ctx.isDemo
    ? "open-api-swap-testnet.bingx.com"
    : "api.bingx.com";
  const ts = Date.now();
  const recvWindow = 5000;

  // Build the param string for signing. For GET, params go in URL.
  // For POST, body goes in URL too (as the request payload).
  const allParams: Record<string, string> = { ...(opts.params ?? {}) };
  let bodyStr = "";
  if (method === "POST" && opts.body) {
    bodyStr = JSON.stringify(opts.body);
    // BingX V2 expects the JSON body string to be signed
  }

  // For GET/DELETE: sign the param string
  // For POST: BingX V2 uses URL params too with HMAC sign of body+params
  let paramStr = "";
  if (Object.keys(allParams).length > 0) {
    paramStr = Object.entries(allParams)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
  }
  const signature = sign(method === "POST" ? bodyStr : paramStr, ts, recvWindow, ctx.apiSecret);

  const headers: Record<string, string> = {
    "X-BX-APIKEY": ctx.apiKey,
    "X-BX-SIGNATURE": signature,
    "X-BX-TIMESTAMP": String(ts),
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const url =
    method === "POST"
      ? `https://${baseHost}${path}?${paramStr ? paramStr + "&" : ""}timestamp=${ts}&recvWindow=${recvWindow}&signature=${signature}`
      : `https://${baseHost}${path}?${paramStr ? paramStr + "&" : ""}timestamp=${ts}&recvWindow=${recvWindow}&signature=${signature}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: method === "POST" && bodyStr ? bodyStr : undefined,
      cache: "no-store",
      redirect: "error",
    });
  } catch (err: any) {
    return {
      status: 502,
      json: { code: -1, msg: `Network error: ${err?.message ?? err}` } as T,
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
  // Try demo (testnet) first
  const demoRes = await callBingx(
    { apiKey, apiSecret, isDemo: true },
    "GET",
    "/openApi/spot/v1/account/balance",
  );
  const demoErr = {
    status: demoRes.status,
    code: (demoRes.json as any)?.code,
    msg: (demoRes.json as any)?.msg || (demoRes.json as any)?.developerMsg,
  };
  // BingX returns code 0 on success
  if (demoRes.status === 200 && (demoRes.json as any)?.code === 0) {
    const account = (demoRes.json as any)?.data;
    return {
      environment: "demo",
      accountBalance: account,
      balance: flattenBalance(account),
    };
  }
  // Try live
  const liveRes = await callBingx(
    { apiKey, apiSecret, isDemo: false },
    "GET",
    "/openApi/spot/v1/account/balance",
  );
  const liveErr = {
    status: liveRes.status,
    code: (liveRes.json as any)?.code,
    msg: (liveRes.json as any)?.msg || (liveRes.json as any)?.developerMsg,
  };
  if (liveRes.status === 200 && (liveRes.json as any)?.code === 0) {
    const account = (liveRes.json as any)?.data;
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

// ---------------- Helpers to parse BingX balance ----------------

function flattenBalance(data: any) {
  // BingX GET /openApi/spot/v1/account/balance returns:
  // { code: 0, data: { accountBalance: "123.45", ... balances: [{ asset, free, locked }] } }
  if (!data) return null;
  const balances: { ccy: string; total: number; available: number }[] = [];
  const list = data.balances ?? [];
  let totalUsd = parseFloat(data.accountBalance ?? "0");
  for (const b of list) {
    const ccy: string = b.asset;
    const free: number = parseFloat(b.free ?? "0");
    const locked: number = parseFloat(b.locked ?? "0");
    if (free > 0 || locked > 0) {
      balances.push({ ccy, total: free + locked, available: free });
    }
  }
  return {
    totalEqUsd: totalUsd,
    uplUsd: 0,
    uplRatio: 0,
    details: balances,
  };
}

// ---------------- Diagnostic helper ----------------

function diagnoseBingxError(
  demoErr: any,
  liveErr: any,
): { title: string; hint: string } {
  const e = liveErr?.msg ? liveErr : demoErr;
  const code = e?.code;
  const rawMsg = (e?.msg ?? "").toLowerCase();

  // Empty 401 — usually BingX's auth headers aren't reaching the server.
  if (!rawMsg && (liveErr?.status === 401 || demoErr?.status === 401 || liveErr?.status === 400)) {
    return {
      title: "BingX rejected the auth signature",
      hint:
        "BingX returned an auth failure with no error body — usually means " +
        "the API key format is wrong (BingX keys are 64+ chars) or the " +
        "signature is malformed. Re-copy both the API key and secret from " +
        "BingX → API Management. Make sure you're using a key with 'Read' " +
        "permission minimum.",
    };
  }
  if (rawMsg.includes("sign") && (rawMsg.includes("invalid") || rawMsg.includes("wrong"))) {
    return {
      title: "Signature rejected by BingX",
      hint:
        "The HMAC-SHA256 signature didn't match. Re-copy the API SECRET from " +
        "BingX → API Management (no trailing spaces, no leading whitespace).",
    };
  }
  if (rawMsg.includes("api key") && rawMsg.includes("invalid")) {
    return {
      title: "BingX API key not recognized",
      hint:
        "BingX rejected the API key. Re-copy it from BingX → API Management. " +
        "Demo (testnet) and live API keys are SEPARATE — verify you're " +
        "using the right one for the right environment.",
    };
  }
  if (rawMsg.includes("timestamp")) {
    return {
      title: "Clock skew — server timestamp too old",
      hint:
        "BingX rejects requests where the timestamp differs from server time " +
        "by more than the recvWindow (5s). Sync your system clock and retry.",
    };
  }
  if (rawMsg.includes("ip") && (rawMsg.includes("restrict") || rawMsg.includes("forbidden") || rawMsg.includes("whitelist"))) {
    return {
      title: "IP not on BingX allowlist",
      hint:
        "Your BingX API key has an IP restriction. Either set the key to allow " +
        "ANY IP in BingX → API Management, or add this server's outbound IP " +
        "to the allowlist.",
    };
  }
  if (rawMsg.includes("permission") || rawMsg.includes("no permission")) {
    return {
      title: "API key lacks required permissions",
      hint:
        "BingX rejected because the API key doesn't have the required scope. " +
        "Edit the key in BingX → API Management → enable 'Read-Write' and " +
        "'Spot Trade' permissions.",
    };
  }
  if (rawMsg.includes("network") || rawMsg.includes("enotfound") || rawMsg.includes("fetch failed")) {
    return {
      title: "Couldn't reach BingX",
      hint:
        "The server couldn't resolve or reach BingX. Check network/DNS. " +
        "If behind a firewall, allow outbound HTTPS to api.bingx.com and " +
        "open-api-swap-testnet.bingx.com.",
    };
  }
  return {
    title: "BingX rejected the request",
    hint:
      `BingX returned HTTP ${e?.status ?? "?"}` +
      (code ? ` with code ${code}` : "") +
      (rawMsg ? `: ${rawMsg}` : ". No error body returned.") +
      " Verify the API key + secret are correct, that you're using a key " +
      "with 'Read' permission minimum, and that your BingX account isn't " +
      "in a restricted region.",
  };
}

// ---------------- GET handler — auto-probe + convenience paths ----------------

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "probe";

  const apiKey = req.headers.get("x-bingx-key") ?? "";
  const apiSecret = req.headers.get("x-bingx-secret") ?? "";

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      {
        error:
          "Missing credentials. Pass x-bingx-key, x-bingx-secret headers.",
      },
      { status: 400 },
    );
  }

  if (action === "probe") {
    const result = await probeEnvironment(apiKey, apiSecret);
    if (result.environment === "unknown") {
      const helper = diagnoseBingxError(result.demoError, result.liveError);
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
    const { status, json } = await callBingx(
      { apiKey, apiSecret, isDemo: env },
      "GET",
      "/openApi/spot/v1/account/balance",
    );
    if (status !== 200 || (json as any)?.code !== 0) {
      return NextResponse.json(
        { ok: false, error: (json as any)?.msg ?? `HTTP ${status}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, balance: flattenBalance((json as any)?.data) });
  }

  if (action === "positions") {
    const env = (url.searchParams.get("env") ?? "live") === "demo";
    const { status, json } = await callBingx(
      { apiKey, apiSecret, isDemo: env },
      "GET",
      "/openApi/spot/v1/position/positions",
    );
    return NextResponse.json(json, { status });
  }

  if (action === "fills") {
    const env = (url.searchParams.get("env") ?? "live") === "demo";
    const { status, json } = await callBingx(
      { apiKey, apiSecret, isDemo: env },
      "GET",
      "/openApi/spot/v1/user/tradeHistory",
    );
    return NextResponse.json(json, { status });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
