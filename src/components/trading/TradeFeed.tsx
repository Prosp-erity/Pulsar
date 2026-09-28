"use client";

import { useTradingStore } from "@/lib/store/trading-store";
import { STRATEGIES } from "@/lib/trading/strategies";
import { fmtPrice, fmtUsd, fmtPct, timeAgo } from "@/lib/trading/engine";
import { useLiveTradingStatus } from "@/hooks/use-live-trading-status";
import { useOkxLiveAccount } from "@/hooks/use-okx-live-account";
import { useBybitLiveAccount } from "@/hooks/use-bybit-live-account";
import { useBingxLiveAccount } from "@/hooks/use-bingx-live-account";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

export function TradeFeed() {
  const trades = useTradingStore((s) => s.trades);
  const live = useLiveTradingStatus();
  const okx = useOkxLiveAccount();
  const bybit = useBybitLiveAccount();
  const bingx = useBingxLiveAccount();

  const isLive = live.isLive && live.liveActive;
  const isOkxLive = isLive && live.exchangeId === "okx";
  const isBybitLive = isLive && live.exchangeId === "bybit";
  const isBingxLive = isLive && live.exchangeId === "bingx";

  // When a real broker is live, show real fills
  if (isOkxLive) {
    return <BrokerTradeFeed
      brokerName="OKX"
      envLabel={okx.environment === "demo" ? "Demo" : "Live"}
      loading={okx.loading}
      error={okx.error}
      lastUpdated={okx.lastUpdated}
      fills={okx.fills.map((f) => ({
        instId: f.instId,
        side: f.side === "buy" ? "BUY" : "SELL",
        fillSz: f.fillSz,
        fillPx: f.fillPx,
        fee: f.fee,
        feeCcy: f.feeCcy,
        ts: f.ts,
        billId: f.billId,
      }))}
    />;
  }
  if (isBybitLive) {
    return <BrokerTradeFeed
      brokerName="Bybit"
      envLabel={bybit.environment === "demo" ? "Testnet" : "Mainnet"}
      loading={bybit.loading}
      error={bybit.error}
      lastUpdated={bybit.lastUpdated}
      fills={bybit.fills.map((f) => ({
        instId: f.symbol,
        side: f.side === "Buy" ? "BUY" : "SELL",
        fillSz: f.execQty,
        fillPx: f.execPrice,
        fee: f.fee,
        feeCcy: f.feeTokenId,
        ts: f.execTime,
        billId: f.execId,
      }))}
    />;
  }
  if (isBingxLive) {
    return <BrokerTradeFeed
      brokerName="BingX"
      envLabel={bingx.environment === "demo" ? "Testnet" : "Mainnet"}
      loading={bingx.loading}
      error={bingx.error}
      lastUpdated={bingx.lastUpdated}
      fills={bingx.fills.map((f) => ({
        instId: f.symbol,
        side: f.side === "BUY" ? "BUY" : "SELL",
        fillSz: f.executedQty,
        fillPx: f.executedPrice,
        fee: f.fee,
        feeCcy: f.feeAsset,
        ts: f.time,
        billId: f.tradeId,
      }))}
    />;
  }

  return (
    <div
      className={cn(
        "glass rounded-xl flex flex-col h-full overflow-hidden",
        isLive && "border border-red-500/30 shadow-[0_0_30px_-15px_rgba(239,68,68,0.7)]",
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            {isLive ? "Live Trade Feed" : "Trade Feed"}
            {isLive && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold tracking-wider border bg-red-500/20 text-red-200 border-red-500/40">
                <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse-dot" />
                LIVE
              </span>
            )}
          </div>
          <div className="font-semibold text-sm">
            {trades.length} closed {isLive ? "live " : ""}trades
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        {trades.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {isLive ? "Live fills will appear here in real time." : "Closed trades will appear here in real time."}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {trades.map((t) => {
              const strat = STRATEGIES[t.strategy];
              const win = t.outcome === "WIN";
              return (
                <div
                  key={t.id}
                  className={cn(
                    "px-4 py-2.5 hover:bg-white/[0.03] transition",
                    win
                      ? "border-l-2 border-emerald-500/50"
                      : t.outcome === "LOSS"
                        ? "border-l-2 border-red-500/50"
                        : "border-l-2 border-white/10",
                    isLive && win && "bg-emerald-500/[0.02]",
                    isLive && !win && t.outcome === "LOSS" && "bg-red-500/[0.02]",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono",
                          t.side === "LONG"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300",
                        )}
                      >
                        {t.side}
                      </span>
                      <span className="font-mono text-xs font-semibold">
                        {t.pair}
                      </span>
                      {isLive && (
                        <span className="text-[8px] px-1 rounded font-bold tracking-wider bg-red-500/30 text-red-200">
                          LIVE FILL
                        </span>
                      )}
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                        style={{
                          backgroundColor: `${strat.color}20`,
                          color: strat.color,
                        }}
                      >
                        {strat.name}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "font-mono text-xs tabular-nums font-semibold",
                        t.pnl > 0 ? "text-emerald-300" : t.pnl < 0 ? "text-red-300" : "text-muted-foreground",
                      )}
                    >
                      {t.pnl >= 0 ? "+" : ""}
                      {fmtUsd(t.pnl)}
                      <span className="text-[10px] opacity-70 ml-1">
                        ({fmtPct(t.pnlPct)})
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground font-mono tabular-nums">
                    <span>
                      @ {fmtPrice(t.entryPrice)} → {fmtPrice(t.exitPrice)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-1 rounded",
                          win
                            ? "text-emerald-300"
                            : t.outcome === "LOSS"
                            ? "text-red-300"
                            : "text-muted-foreground",
                        )}
                      >
                        {t.reason}
                      </span>
                      <span>· {timeAgo(t.closedAt)}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Generic real broker fills feed ----------------
// Used by both OKX and Bybit — receives normalized fills.

function BrokerTradeFeed({
  brokerName,
  envLabel,
  loading,
  error,
  lastUpdated,
  fills,
}: {
  brokerName: string;
  envLabel: string;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  fills: {
    instId: string;
    side: string;
    fillSz: string;
    fillPx: string;
    fee: string;
    feeCcy: string;
    ts: string;
    billId: string;
  }[];
}) {
  const isLoading = loading && fills.length === 0;
  const hasError = error && fills.length === 0;

  return (
    <div className="glass rounded-xl flex flex-col h-full overflow-hidden border border-red-500/30 shadow-[0_0_30px_-15px_rgba(239,68,68,0.7)]">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            Live {brokerName} Trade Fills
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold tracking-wider border bg-red-500/20 text-red-200 border-red-500/40">
              <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse-dot" />
              LIVE · {brokerName} {envLabel}
            </span>
          </div>
          <div className="font-semibold text-sm">
            {fills.length} recent fills
            {lastUpdated ? ` · last sync ${new Date(lastUpdated).toLocaleTimeString()}` : ""}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Fetching your live {brokerName} fills (last 7 days)…
          </div>
        ) : hasError ? (
          <div className="p-8 text-center text-sm text-red-300 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {brokerName} error: {error}
          </div>
        ) : fills.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No recent fills on your live {brokerName} account (last 7 days).
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {fills.map((f, i) => {
              const fillSz = parseFloat(f.fillSz ?? "0");
              const fillPx = parseFloat(f.fillPx ?? "0");
              const fee = parseFloat(f.fee ?? "0");
              const notional = fillSz * fillPx;
              const ts = parseInt(f.ts ?? "0");
              const isBuy = f.side === "BUY";
              return (
                <div
                  key={`${f.billId ?? i}`}
                  className={cn(
                    "px-4 py-2.5 hover:bg-white/[0.03] transition border-l-2",
                    isBuy ? "border-emerald-500/50" : "border-red-500/50",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono",
                          isBuy
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300",
                        )}
                      >
                        {isBuy ? "BUY" : "SELL"}
                      </span>
                      <span className="font-mono text-xs font-semibold">
                        {f.instId}
                      </span>
                      <span className="text-[8px] px-1 rounded font-bold tracking-wider bg-red-500/30 text-red-200">
                        LIVE FILL
                      </span>
                    </div>
                    <span
                      className={cn(
                        "font-mono text-xs tabular-nums font-semibold",
                        isBuy ? "text-emerald-300" : "text-red-300",
                      )}
                    >
                      {isBuy ? "+" : "-"}{fmtUsd(notional)}
                      <span className="text-[10px] opacity-70 ml-1">
                        ({fillSz} @ {fmtPrice(fillPx)})
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground font-mono tabular-nums">
                    <span>
                      Fee: {fee} {f.feeCcy}
                    </span>
                    <span>· {ts ? timeAgo(ts) : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
