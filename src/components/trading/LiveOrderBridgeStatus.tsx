"use client";

import { useState } from "react";
import { useOkxOrderBridge } from "@/hooks/use-okx-order-bridge";
import { useBybitOrderBridge } from "@/hooks/use-bybit-order-bridge";
import { useBingxOrderBridge } from "@/hooks/use-bingx-order-bridge";
import { useLiveTradingStatus } from "@/hooks/use-live-trading-status";
import { useOkxLiveAccount } from "@/hooks/use-okx-live-account";
import { useBybitLiveAccount } from "@/hooks/use-bybit-live-account";
import { useBingxLiveAccount } from "@/hooks/use-bingx-live-account";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Activity } from "lucide-react";

/**
 * Live order bridge status card shown on the dashboard when live
 * trading is on with a connected exchange that supports real order
 * placement (currently OKX, Bybit, and BingX). Surfaces:
 *   - Engine ↔ broker connection state
 *   - Recent order placements (last 5)
 *   - Errors (so the user can see immediately when an order fails)
 *
 * For exchanges that don't support real order placement yet (Binance,
 * MetaAPI, MT5), this card doesn't render.
 */
export function LiveOrderBridgeStatus() {
  const live = useLiveTradingStatus();
  const okx = useOkxLiveAccount();
  const bybit = useBybitLiveAccount();
  const bingx = useBingxLiveAccount();
  const okxBridge = useOkxOrderBridge();
  const bybitBridge = useBybitOrderBridge();
  const bingxBridge = useBingxOrderBridge();
  const [visible, setVisible] = useState(true);

  const okxLive = !!(live.liveActive && live.exchangeId === "okx");
  const bybitLive = !!(live.liveActive && live.exchangeId === "bybit");
  const bingxLive = !!(live.liveActive && live.exchangeId === "bingx");

  // No supported live broker — don't render
  if (!okxLive && !bybitLive && !bingxLive) return null;

  // Pick which exchange's data to display
  const isOkx = okxLive;
  const exchangeName = isOkx ? "OKX" : bybitLive ? "Bybit" : "BingX";
  const account = isOkx ? okx : bybitLive ? bybit : bingx;
  const events = isOkx ? okxBridge.events : bybitLive ? bybitBridge.events : bingxBridge.events;

  const last5 = events.slice(0, 5);
  const placed = events.filter((e) => e.status === "placed").length;
  const rejected = events.filter((e) => e.status === "rejected").length;
  const errored = events.filter((e) => e.status === "error").length;

  return (
    <div className="glass rounded-xl p-3 border border-red-500/20 bg-red-500/[0.03]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse-dot" />
          <span className="text-[10px] uppercase tracking-widest text-red-300 font-bold">
            Live Order Bridge · {exchangeName}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {account.environment === "demo"
              ? `${exchangeName} Testnet`
              : `${exchangeName} Live`}{" "}
            ·{" "}
            {account.loading
              ? "syncing…"
              : account.error
                ? "API error"
                : "synced"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-emerald-300">{placed} placed</span>
          {rejected > 0 && (
            <span className="text-amber-300">{rejected} rejected</span>
          )}
          {errored > 0 && <span className="text-red-300">{errored} errors</span>}
          <button
            onClick={() => setVisible(!visible)}
            className="text-muted-foreground hover:text-foreground px-1"
            title={visible ? "Hide recent activity" : "Show recent activity"}
          >
            {visible ? "−" : "+"}
          </button>
        </div>
      </div>

      {visible && (
        <div className="space-y-1">
          {last5.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic">
              Waiting for the engine to fire its first live signal — orders
              will appear here automatically when strategies trigger entries.
            </div>
          ) : (
            last5.map((e) => {
              const icon =
                e.status === "placed" ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : e.status === "rejected" ? (
                  <XCircle className="w-3 h-3 text-amber-400" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-400" />
                );
              const sideLabel = e.side;
              const sideColor =
                e.side === "buy" || e.side === "Buy"
                  ? "text-emerald-300"
                  : "text-red-300";
              const symbolOrInstId = (e as any).instId || (e as any).symbol;
              const sizeOrQty = (e as any).sz || (e as any).qty;
              const orderId = (e as any).ordId || (e as any).orderId;
              return (
                <div
                  key={`${e.id}-${e.ts}`}
                  className="flex items-center gap-2 text-[11px] font-mono"
                >
                  {icon}
                  <span className={cn("font-bold", sideColor)}>
                    {String(sideLabel).toUpperCase()}
                  </span>
                  <span className="font-semibold">{symbolOrInstId}</span>
                  <span className="text-muted-foreground">{sizeOrQty}</span>
                  {orderId && (
                    <span className="text-muted-foreground">
                      ord: {String(orderId).slice(0, 12)}…
                    </span>
                  )}
                  {e.error && (
                    <span className="text-red-300">⚠ {e.error}</span>
                  )}
                  <span className="ml-auto text-muted-foreground/60">
                    {new Date(e.ts).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                </div>
              );
            })
          )}
          {account.error && (
            <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/30 text-[10px] text-red-300">
              <Activity className="w-3 h-3" />
              {exchangeName} API error: {account.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
