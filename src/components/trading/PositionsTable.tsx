"use client";

import { X, AlertCircle } from "lucide-react";
import { useTradingStore } from "@/lib/store/trading-store";
import { STRATEGIES } from "@/lib/trading/strategies";
import { fmtPrice, fmtUsd, fmtPct, timeAgo } from "@/lib/trading/engine";
import { Button } from "@/components/ui/button";
import { useLiveTradingStatus } from "@/hooks/use-live-trading-status";
import { useOkxLiveAccount, type OkxPosition } from "@/hooks/use-okx-live-account";
import { useBybitLiveAccount, type BybitPosition } from "@/hooks/use-bybit-live-account";
import { useBingxLiveAccount, type BingxPosition } from "@/hooks/use-bingx-live-account";
import { cn } from "@/lib/utils";

export function PositionsTable() {
  const positions = useTradingStore((s) => s.positions);
  const prices = useTradingStore((s) => s.prices);
  const closePosition = useTradingStore((s) => s.closePositionManually);
  const closeAll = useTradingStore((s) => s.closeAllPositions);
  const live = useLiveTradingStatus();
  const okx = useOkxLiveAccount();
  const bybit = useBybitLiveAccount();
  const bingx = useBingxLiveAccount();

  const isLive = live.isLive && live.liveActive;
  const isOkxLive = isLive && live.exchangeId === "okx";
  const isBybitLive = isLive && live.exchangeId === "bybit";
  const isBingxLive = isLive && live.exchangeId === "bingx";

  // When OKX, Bybit, or BingX is live, show real broker positions
  if (isOkxLive) {
    return <BrokerPositionsTable
      brokerName="OKX"
      envLabel={okx.environment === "demo" ? "Demo" : "Live"}
      loading={okx.loading}
      error={okx.error}
      lastUpdated={okx.lastUpdated}
      positions={okx.positions.map((p) => ({
        instId: p.instId,
        side: (p.posSide === "long" || (p.posSide === "net" && parseFloat(p.pos) > 0)) ? "LONG" : "SHORT",
        size: p.pos,
        avgPx: p.avgPx,
        markPx: p.markPx,
        upl: p.upl,
        uplRatio: p.uplRatio,
        cTime: p.cTime,
      }))}
    />;
  }
  if (isBybitLive) {
    return <BrokerPositionsTable
      brokerName="Bybit"
      envLabel={bybit.environment === "demo" ? "Testnet" : "Mainnet"}
      loading={bybit.loading}
      error={bybit.error}
      lastUpdated={bybit.lastUpdated}
      positions={bybit.positions.map((p) => ({
        instId: p.symbol,
        side: p.side === "Buy" ? "LONG" : p.side === "Sell" ? "SHORT" : "FLAT",
        size: p.size,
        avgPx: p.avgPrice,
        markPx: p.markPrice,
        upl: p.unrealisedPnl,
        uplRatio: (parseFloat(p.unrealisedPnlPct) / 100).toString(),
        cTime: p.createdTime,
      }))}
    />;
  }
  if (isBingxLive) {
    return <BrokerPositionsTable
      brokerName="BingX"
      envLabel={bingx.environment === "demo" ? "Testnet" : "Mainnet"}
      loading={bingx.loading}
      error={bingx.error}
      lastUpdated={bingx.lastUpdated}
      positions={bingx.positions.map((p) => ({
        instId: p.symbol,
        side: p.positionSide === "LONG" ? "LONG" : p.positionSide === "SHORT" ? "SHORT" : "FLAT",
        size: p.positionAmt,
        avgPx: p.avgPrice,
        markPx: p.markPrice,
        upl: p.unrealizedPnl,
        uplRatio: p.unrealizedPnlPct,
        cTime: p.cTime,
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
        <div className="flex items-center gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              {isLive ? "Open Live Positions" : "Open Positions"}
              {isLive && (
                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold tracking-wider border bg-red-500/20 text-red-200 border-red-500/40">
                  <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse-dot" />
                  LIVE
                </span>
              )}
            </div>
            <div className="font-semibold text-sm">
              {positions.length} active
              {isLive ? ` · ${live.primaryExchange ?? "—"} ${live.exchangeMode ?? ""}` : ""}
            </div>
          </div>
        </div>
        {positions.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={closeAll}
            className="border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300"
          >
            Close All{isLive ? " (Cancel Live Orders)" : ""}
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        {positions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No open positions. {isLive ? "Start the engine to begin live trading." : "Start the engine to begin trading."}
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-card/95 backdrop-blur z-10">
              <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-white/5">
                <th className="px-3 py-2 font-medium">Pair</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Strategy</th>
                <th className="px-3 py-2 font-medium text-right">Entry</th>
                <th className="px-3 py-2 font-medium text-right">Mark</th>
                <th className="px-3 py-2 font-medium text-right">Size</th>
                <th className="px-3 py-2 font-medium text-right">uPnL</th>
                <th className="px-3 py-2 font-medium text-right">Age</th>
                <th className="px-3 py-2 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const px = prices[p.pair] ?? p.entryPrice;
                const dir = p.side === "LONG" ? 1 : -1;
                const pnl = (px - p.entryPrice) * p.size * dir;
                const pnlPct = (pnl / p.notional) * 100;
                const strat = STRATEGIES[p.strategy];
                return (
                  <tr
                    key={p.id}
                    className="border-b border-white/5 hover:bg-white/[0.03] transition font-mono tabular-nums"
                  >
                    <td className="px-3 py-2 font-semibold">
                      <span className="flex items-center gap-1.5">
                        {p.pair}
                        {isLive && (
                          <span className="text-[8px] px-1 rounded font-bold tracking-wider bg-red-500/30 text-red-200">
                            LIVE
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold",
                          p.side === "LONG"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300",
                        )}
                      >
                        {p.side}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{
                          backgroundColor: `${strat.color}20`,
                          color: strat.color,
                        }}
                      >
                        {strat.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {fmtPrice(p.entryPrice)}
                    </td>
                    <td className="px-3 py-2 text-right">{fmtPrice(px)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {p.size.toFixed(p.size < 1 ? 4 : 3)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-semibold",
                        pnl >= 0 ? "text-emerald-300" : "text-red-300",
                      )}
                    >
                      {pnl >= 0 ? "+" : ""}
                      {fmtUsd(pnl)}
                      <div className="text-[10px] opacity-70">
                        {fmtPct(pnlPct)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground text-[10px]">
                      {timeAgo(p.openedAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 hover:bg-red-500/20 hover:text-red-300"
                        onClick={() => closePosition(p.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------- Generic real broker positions table ----------------
// Used by both OKX and Bybit — receives normalized positions.

function BrokerPositionsTable({
  brokerName,
  envLabel,
  loading,
  error,
  lastUpdated,
  positions,
}: {
  brokerName: string;
  envLabel: string;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  positions: {
    instId: string;
    side: string;
    size: string;
    avgPx: string;
    markPx: string;
    upl: string;
    uplRatio: string;
    cTime: string;
  }[];
}) {
  const isLoading = loading && positions.length === 0;
  const hasError = error && positions.length === 0;

  return (
    <div className="glass rounded-xl flex flex-col h-full overflow-hidden border border-red-500/30 shadow-[0_0_30px_-15px_rgba(239,68,68,0.7)]">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            Open Live Positions
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold tracking-wider border bg-red-500/20 text-red-200 border-red-500/40">
              <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse-dot" />
              LIVE · {brokerName} {envLabel}
            </span>
          </div>
          <div className="font-semibold text-sm">
            {positions.length} active positions
            {lastUpdated ? ` · last sync ${new Date(lastUpdated).toLocaleTimeString()}` : ""}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Fetching your live {brokerName} positions…
          </div>
        ) : hasError ? (
          <div className="p-8 text-center text-sm text-red-300 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {brokerName} error: {error}
          </div>
        ) : positions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No open positions on your live {brokerName} account.
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-card/95 backdrop-blur z-10">
              <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-white/5">
                <th className="px-3 py-2 font-medium">Instrument</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium text-right">Size</th>
                <th className="px-3 py-2 font-medium text-right">Avg Entry</th>
                <th className="px-3 py-2 font-medium text-right">Mark</th>
                <th className="px-3 py-2 font-medium text-right">uPnL</th>
                <th className="px-3 py-2 font-medium text-right">Age</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const avgPx = parseFloat(p.avgPx ?? "0");
                const markPx = parseFloat(p.markPx ?? "0");
                const upl = parseFloat(p.upl ?? "0");
                const ratio = parseFloat(p.uplRatio ?? "0");
                const side = p.side;
                const openedAt = p.cTime ? parseInt(p.cTime) : 0;
                return (
                  <tr
                    key={`${p.instId}-${i}`}
                    className="border-b border-white/5 hover:bg-white/[0.03] transition font-mono tabular-nums"
                  >
                    <td className="px-3 py-2 font-semibold">
                      <span className="flex items-center gap-1.5">
                        {p.instId}
                        <span className="text-[8px] px-1 rounded font-bold tracking-wider bg-red-500/30 text-red-200">
                          LIVE
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold",
                          side === "LONG"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300",
                        )}
                      >
                        {side}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {p.size}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {fmtPrice(avgPx)}
                    </td>
                    <td className="px-3 py-2 text-right">{fmtPrice(markPx)}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-semibold",
                        upl >= 0 ? "text-emerald-300" : "text-red-300",
                      )}
                    >
                      {upl >= 0 ? "+" : ""}
                      {fmtUsd(upl)}
                      <div className="text-[10px] opacity-70">
                        {fmtPct(ratio * 100)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground text-[10px]">
                      {openedAt ? timeAgo(openedAt) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
