"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FlaskConical, TrendingUp } from "lucide-react";
import { STRATEGIES } from "@/lib/trading/strategies";
import { selectStrategyLiveStats, useTradingStore } from "@/lib/store/trading-store";
import type { StrategyId } from "@/lib/trading/types";
import { fmtUsd, fmtPct } from "@/lib/trading/engine";
import { cn } from "@/lib/utils";

export function StrategyPanel() {
  const [open, setOpen] = useState<StrategyId | null>("connors_rsi");
  const trades = useTradingStore((s) => s.trades);
  const positions = useTradingStore((s) => s.positions);
  const byStrategy = useTradingStore((s) => s.backtest.byStrategy);
  const backtestStatus = useTradingStore((s) => s.backtest.status);
  const setActiveView = useTradingStore((s) => s.setActiveView);
  const live = selectStrategyLiveStats(trades, positions);

  return (
    <div className="glass rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Strategy Stack
          </div>
          <div className="font-semibold text-sm">5 High Win-Rate Strategies</div>
        </div>
        <FlaskConical className="w-4 h-4 text-cyan-300" />
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin -mr-2 pr-2 space-y-2">
        {Object.values(STRATEGIES).map((s) => {
          const isOpen = open === s.id;
          const l = live[s.id];
          const livePnl = l.pnl;
          const liveWinRate = l.trades > 0 ? (l.wins / l.trades) * 100 : 0;
          const bt = byStrategy[s.id];
          return (
            <div
              key={s.id}
              className={cn(
                "rounded-lg border transition-all",
                isOpen
                  ? "bg-white/[0.04] border-white/15"
                  : "bg-white/[0.02] border-white/5 hover:border-white/10",
              )}
            >
              <button
                className="w-full px-3 py-2.5 flex items-center gap-2 text-left"
                onClick={() => setOpen(isOpen ? null : s.id)}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}` }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {s.tagline}
                  </div>
                </div>
                <div
                  className={cn(
                    "font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded",
                    livePnl >= 0
                      ? "text-emerald-300 bg-emerald-500/10"
                      : "text-red-300 bg-red-500/10",
                  )}
                >
                  {livePnl >= 0 ? "+" : ""}
                  {fmtUsd(livePnl)}
                </div>
                {isOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 space-y-3">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>
                  <div className="text-[10px] text-cyan-300/80">
                    Best for: <span className="text-foreground">{s.bestFor}</span>
                  </div>

                  {/* Live 3-month backtest */}
                  {bt ? (
                    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-2.5">
                      <div className="text-[9px] uppercase tracking-widest text-emerald-300 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-emerald-400" />
                          Live 3-Month Backtest
                        </span>
                        <span className="text-muted-foreground font-normal">
                          {bt.symbol} · {bt.stats.totalTrades} trades
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        <Stat
                          label="Return"
                          value={fmtPct(bt.stats.totalReturn)}
                          pos={bt.stats.totalReturn >= 0}
                          neg={bt.stats.totalReturn < 0}
                        />
                        <Stat label="Win Rate" value={`${bt.stats.winRate.toFixed(1)}%`} pos={bt.stats.winRate >= 50} />
                        <Stat label="PF" value={bt.stats.profitFactor.toFixed(2)} pos={bt.stats.profitFactor >= 1.5} />
                        <Stat label="Sharpe" value={bt.stats.sharpe.toFixed(2)} pos={bt.stats.sharpe >= 2} />
                      </div>
                    </div>
                  ) : backtestStatus === "running" ? (
                    <div className="bg-white/[0.02] border border-white/10 rounded-lg p-2.5 text-[10px] text-muted-foreground text-center">
                      Running 3-month backtest…
                    </div>
                  ) : null}

                  {/* Verified stats */}
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-cyan-300/80 mb-1.5 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-cyan-400" />
                      Verified Backtest (published)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <Stat label="Win Rate" value={`${s.backtest.winRate.toFixed(1)}%`} pos={s.backtest.winRate >= 60} />
                      <Stat label="Profit Factor" value={s.backtest.profitFactor.toFixed(2)} pos={s.backtest.profitFactor >= 1.5} />
                      <Stat label="Avg R:R" value={`1:${s.backtest.avgRR.toFixed(2)}`} />
                      <Stat label="Sharpe" value={s.backtest.sharpe.toFixed(2)} pos={s.backtest.sharpe >= 2} />
                      <Stat label="Max DD" value={`-${s.backtest.maxDrawdown.toFixed(1)}%`} neg />
                      <Stat label="Ann. Return" value={`${s.backtest.annualizedReturn.toFixed(1)}%`} pos />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 mt-1">
                      <span>
                        {s.backtest.timeframe} · {s.backtest.period}
                      </span>
                      <span>{s.backtest.trades.toLocaleString()} trades</span>
                    </div>
                  </div>

                  {/* Live session stats */}
                  <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                    <TrendingUp className="w-3 h-3 text-emerald-300" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Live Session
                    </span>
                    <span className="text-[11px] font-mono tabular-nums">
                      {l.trades} trades · {liveWinRate.toFixed(0)}% win
                    </span>
                  </div>

                  <button
                    onClick={() => setActiveView("backtest")}
                    className="w-full text-[11px] py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-cyan-300 transition-colors"
                  >
                    View full backtest →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  pos,
  neg,
}: {
  label: string;
  value: string;
  pos?: boolean;
  neg?: boolean;
}) {
  return (
    <div className="flex items-center justify-between bg-white/[0.03] rounded px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums font-semibold",
          pos && "text-emerald-300",
          neg && "text-red-300",
          !pos && !neg && "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

