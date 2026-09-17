"use client";

import { X } from "lucide-react";
import { useTradingStore } from "@/lib/store/trading-store";
import { STRATEGIES } from "@/lib/trading/strategies";
import { fmtPrice, fmtUsd, fmtPct, timeAgo } from "@/lib/trading/engine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PositionsTable() {
  const positions = useTradingStore((s) => s.positions);
  const prices = useTradingStore((s) => s.prices);
  const closePosition = useTradingStore((s) => s.closePositionManually);
  const closeAll = useTradingStore((s) => s.closeAllPositions);

  return (
    <div className="glass rounded-xl flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Open Positions
          </div>
          <div className="font-semibold text-sm">
            {positions.length} active
          </div>
        </div>
        {positions.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={closeAll}
            className="border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300"
          >
            Close All
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        {positions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No open positions. Start the engine to begin trading.
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
                    <td className="px-3 py-2 font-semibold">{p.pair}</td>
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
