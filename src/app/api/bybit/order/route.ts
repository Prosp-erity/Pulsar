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

// ---------------- Signing ----------------

function sign(timestamp: number, apiKey: string, recvWindow: number, paramStr: string, secret: string): string {
  const prehash = `${timestamp}${apiKey}${recvWindow}${paramStr}`;
  return crypto.createHmac("sha256", secret).update(prehash, "utf8").digest("hex");
}

async function callBybit<T = any>(
  ctx: BybitContext,
  method: "GET" | "POST" | "DELETE",
  path: string,
  opts: { query?: Record<string, string>; body?: any } = {},
): Promise<{ status: number; json: T }> {
  const baseHost = ctx.isDemo ? "api-testnet.bybit.com" : "api.bybit.com";
  const paramStr = method === "POST" && opts.body ? JSON.stringify(opts.body) : "";
  const url = `https://${baseHost}${path}${opts.query ? `?${Object.entries(opts.query).map(([k,v]) => `${k}=${v}`).join("&")}` : ""}`;
  const timestamp = Date.now();
  const recvWindow = 5000;
  const signature = sign(timestamp, ctx.apiKey, recvWindow, paramStr, ctx.apiSecret);

  const headers: Record<string, string> = {
    "X-BAPI-API-KEY": ctx.apiKey,
    "X-BAPI-SIGN": signature,
    "X-BAPI-SIGN-TYPE": "2",
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

  const ctx: BybitContext = {
    apiKey: body.apiKey,
    apiSecret: body.apiSecret,
    isDemo: !!body.isDemo,
  };

  if (action === "place") {
    if (!body.symbol || !body.side || !body.qty) {
      return NextResponse.json(
        { error: "symbol, side, qty are required for action=place" },
        { status: 400 },
      );
    }
    // Bybit V5 spot market order body:
    //   category: "spot"
    //   symbol: "BTCUSDT" (no dash)
    //   side: "Buy" | "Sell" (capitalized)
    //   orderType: "Market"
    //   qty: "0.001"
    const sideCapitalized = body.side.toLowerCase() === "buy" ? "Buy" : "Sell";
    const orderBody: Record<string, any> = {
      category: "spot",
      symbol: body.symbol,
      side: sideCapitalized,
      orderType: "Market",
      qty: String(body.qty),
    };
    if (body.orderLinkId) orderBody.orderLinkId = body.orderLinkId;

    const { status, json } = await callBybit(ctx, "POST", "/v5/order/create", {
      body: orderBody,
    });
    if (status !== 200 || (json as any)?.retCode !== 0) {
      return NextResponse.json(
        {
          ok: false,
          error: (json as any)?.retMsg ?? `HTTP ${status}`,
          errorCode: (json as any)?.retCode,
        },
        { status: 502 },
      );
    }
    const ord = (json as any)?.result;
    return NextResponse.json({
      ok: true,
      orderId: ord?.orderId,
      orderLinkId: ord?.orderLinkId,
    });
  }

  if (action === "cancel") {
    if (!body.symbol || (!body.orderId && !body.orderLinkId)) {
      return NextResponse.json(
        { error: "symbol + (orderId or orderLinkId) required for action=cancel" },
        { status: 400 },
      );
    }
    const cancelBody: Record<string, any> = {
      category: "spot",
      symbol: body.symbol,
    };
    if (body.orderId) cancelBody.orderId = body.orderId;
    if (body.orderLinkId) cancelBody.orderLinkId = body.orderLinkId;

    const { status, json } = await callBybit(ctx, "POST", "/v5/order/cancel", {
      body: cancelBody,
    });
    return NextResponse.json(json, { status });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
