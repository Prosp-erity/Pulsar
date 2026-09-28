import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------- Types ----------------

interface PlaceOrderBody {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  isDemo?: boolean;
  instId: string; // e.g. "BTC-USDT"
  side: "buy" | "sell";
  /** Order size in BASE currency (e.g. 0.001 BTC). For market spot orders
   * OKX expects sz in the base currency (BTC, ETH, etc.) not quote (USDT). */
  sz: string;
  /** Optional: client-supplied order ID for idempotency (so retries
   * don't double-place). OKX will dedupe by clOrdId. */
  clOrdId?: string;
}

interface CancelOrderBody {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  isDemo?: boolean;
  instId: string;
  /** OKX ordId OR clOrdId */
  ordId?: string;
  clOrdId?: string;
}

// ---------------- Signing ----------------

function sign(timestamp: string, method: string, requestPath: string, body: string, secret: string): string {
  const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
  return crypto.createHmac("sha256", secret).update(prehash, "utf8").digest("base64");
}

function isoTimestamp(): string {
  return new Date().toISOString();
}

// ---------------- OKX call ----------------

interface OkxContext {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  isDemo: boolean;
}

async function callOkx<T = any>(
  ctx: OkxContext,
  method: "GET" | "POST" | "DELETE",
  path: string,
  opts: { query?: string; body?: any } = {},
): Promise<{ status: number; json: T }> {
  const baseHost = ctx.isDemo ? "simulated-api.okx.com" : "www.okx.com";
  const fullPath = `/api/v5${path}${opts.query ? `?${opts.query}` : ""}`;
  const url = `https://${baseHost}${fullPath}`;
  const bodyStr = opts.body ? JSON.stringify(opts.body) : "";
  const timestamp = isoTimestamp();
  const signature = sign(timestamp, method, fullPath, bodyStr, ctx.apiSecret);

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
      body: bodyStr || undefined,
      cache: "no-store",
      redirect: "error",
    });
  } catch (err: any) {
    return {
      status: 502,
      json: { code: "-1", msg: `Network error: ${err?.message ?? err}` } as T,
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

  if (!body.apiKey || !body.apiSecret || !body.passphrase) {
    return NextResponse.json(
      { error: "apiKey, apiSecret, passphrase are required" },
      { status: 400 },
    );
  }

  const ctx: OkxContext = {
    apiKey: body.apiKey,
    isDemo: !!body.isDemo,
    apiSecret: body.apiSecret,
    passphrase: body.passphrase,
  };

  if (action === "place") {
    if (!body.instId || !body.side || !body.sz) {
      return NextResponse.json(
        { error: "instId, side, sz are required for action=place" },
        { status: 400 },
      );
    }
    // OKX spot market order body:
    //   instId, tdMode="cash", side="buy"|"sell", ordType="market", sz
    // We also set clOrdId if supplied for idempotency.
    const orderBody: Record<string, string> = {
      instId: body.instId,
      tdMode: "cash",
      side: body.side,
      ordType: "market",
      sz: body.sz,
    };
    if (body.clOrdId) orderBody.clOrdId = body.clOrdId;

    const { status, json } = await callOkx(ctx, "POST", "/trade/order", {
      body: orderBody,
    });
    if (status !== 200 || (json as any)?.code !== "0") {
      return NextResponse.json(
        {
          ok: false,
          error: (json as any)?.msg ?? `HTTP ${status}`,
          errorCode: (json as any)?.code,
        },
        { status: 502 },
      );
    }
    const ord = (json as any)?.data?.[0];
    return NextResponse.json({
      ok: true,
      ordId: ord?.ordId,
      clOrdId: ord?.clOrdId,
      sCode: ord?.sCode,
      sMsg: ord?.sMsg,
    });
  }

  if (action === "cancel") {
    if (!body.instId || (!body.ordId && !body.clOrdId)) {
      return NextResponse.json(
        { error: "instId + (ordId or clOrdId) are required for action=cancel" },
        { status: 400 },
      );
    }
    const q: string[] = [`instId=${encodeURIComponent(body.instId)}`];
    if (body.ordId) q.push(`ordId=${encodeURIComponent(body.ordId)}`);
    if (body.clOrdId) q.push(`clOrdId=${encodeURIComponent(body.clOrdId)}`);
    const { status, json } = await callOkx(ctx, "DELETE", "/trade/order", {
      query: q.join("&"),
    });
    return NextResponse.json(json, { status });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
