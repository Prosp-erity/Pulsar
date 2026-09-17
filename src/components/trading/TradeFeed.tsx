"use client";

import { useTradingStore } from "@/lib/store/trading-store";
import { STRATEGIES } from "@/lib/trading/strategies";
import { fmtPrice, fmtUsd, fmtPct, timeAgo } from "@/lib/trading/engine";
import { cn } from "@/lib/utils";

export function TradeFeed() {
  const trades = useTradingStore((s) => s.trades);

  return (
    <div className="glass rounded-xl flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Trade Feed
          </div>
          <div className="font-semibold text-sm">
            {trades.length} closed trades
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        {trades.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Closed trades will appear here in real time.
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
                    win ? "border-l-2 border-emerald-500/50" : t.outcome === "LOSS" ? "border-l-2 border-red-500/50" : "border-l-2 border-white/10",
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
