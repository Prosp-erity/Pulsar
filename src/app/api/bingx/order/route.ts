import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BingxContext {
  apiKey: string;
  apiSecret: string;
  isDemo: boolean;
}

function sign(paramStr: string, ts: number, recvWindow: number, secret: string): string {
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
  const baseHost = ctx.isDemo
    ? "open-api-swap-testnet.bingx.com"
    : "api.bingx.com";
  const ts = Date.now();
  const recvWindow = 5000;

  const allParams: Record<string, string> = { ...(opts.params ?? {}) };
  let bodyStr = "";
  if (method === "POST" && opts.body) {
    bodyStr = JSON.stringify(opts.body);
  }

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
    `https://${baseHost}${path}?${paramStr ? paramStr + "&" : ""}timestamp=${ts}&recvWindow=${recvWindow}&signature=${signature}`;

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

// ---------------- POST handler ----------------

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "place";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.apiKey || !body.apiSecret) {
    return NextResponse.json(
      { error: "apiKey, apiSecret are required" },
      { status: 400 },
    );
  }

  const ctx: BingxContext = {
    apiKey: body.apiKey,
    apiSecret: body.apiSecret,
    isDemo: !!body.isDemo,
  };

  if (action === "place") {
    if (!body.symbol || !body.side || !body.quantity) {
      return NextResponse.json(
        { error: "symbol, side, quantity are required for action=place" },
        { status: 400 },
      );
    }
    // BingX spot market order params (V1):
    //   symbol: "BTC-USDT" (with dash)
    //   side: "BUY" | "SELL" (uppercase)
    //   type: "MARKET"
    //   quantity: "0.001"
    const sideUpper = String(body.side).toUpperCase();
    const orderBody: Record<string, any> = {
      symbol: body.symbol,
      side: sideUpper,
      type: "MARKET",
      quantity: String(body.quantity),
    };
    if (body.newClientOrderId) orderBody.newClientOrderId = body.newClientOrderId;

    // BingX V1 spot place-order endpoint
    const { status, json } = await callBingx(ctx, "POST", "/openApi/spot/v1/trade/order", {
      body: orderBody,
    });
    if (status !== 200 || (json as any)?.code !== 0) {
      return NextResponse.json(
        {
          ok: false,
          error: (json as any)?.msg ?? `HTTP ${status}`,
          errorCode: (json as any)?.code,
        },
        { status: 502 },
      );
    }
    const ord = (json as any)?.data;
    return NextResponse.json({
      ok: true,
      orderId: ord?.orderId,
      clientOrderId: ord?.clientOrderId,
    });
  }

  if (action === "cancel") {
    if (!body.symbol || (!body.orderId && !body.clientOrderId)) {
      return NextResponse.json(
        { error: "symbol + (orderId or clientOrderId) required for action=cancel" },
        { status: 400 },
      );
    }
    const cancelParams: Record<string, string> = {
      symbol: body.symbol,
    };
    if (body.orderId) cancelParams.orderId = String(body.orderId);
    if (body.clientOrderId) cancelParams.clientOrderId = body.clientOrderId;

    const { status, json } = await callBingx(ctx, "DELETE", "/openApi/spot/v1/trade/order", {
      params: cancelParams,
    });
    return NextResponse.json(json, { status });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
