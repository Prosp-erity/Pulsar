"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import { Power, Settings2 } from "lucide-react";
import { useTradingStore } from "@/lib/store/trading-store";
import { STRATEGIES } from "@/lib/trading/strategies";
import { fmtPrice, fmtPct, fmtUsd } from "@/lib/trading/engine";
import type { PairConfig, StrategyId } from "@/lib/trading/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EMPTY_SERIES: { time: number; close: number }[] = [];

export function PairGrid() {
  const pairs = useTradingStore((s) => s.pairs);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {pairs.map((p) => (
        <PairCard key={p.symbol} pair={p} />
      ))}
    </div>
  );
}

function PairCard({ pair }: { pair: PairConfig }) {
  const price = useTradingStore((s) => s.prices[pair.symbol] ?? pair.basePrice);
  const prevPrice = useTradingStore((s) => s.prevPrices[pair.symbol] ?? pair.basePrice);
  const series = useTradingStore((s) => s.candlesCache[pair.symbol] ?? EMPTY_SERIES);
  const allPositions = useTradingStore((s) => s.positions);
  const positions = useMemo(
    () => allPositions.filter((p) => p.pair === pair.symbol),
    [allPositions, pair.symbol],
  );
  const togglePair = useTradingStore((s) => s.togglePair);
  const [openCfg, setOpenCfg] = useState(false);

  const delta = ((price - prevPrice) / prevPrice) * 100;
  const up = delta >= 0;

  // For very first render, derive a pseudo delta from series last two closes
  const baseDelta =
    series.length >= 2
      ? ((series[series.length - 1].close - series[series.length - 2].close) /
          series[series.length - 2].close) *
        100
      : 0;
  const displayDelta = delta !== 0 ? delta : baseDelta;
  const displayUp = displayDelta >= 0;

  const chartData = useMemo(
    () =>
      series.map((c, i) => ({
        i,
        v: c.close,
      })),
    [series],
  );

  const enabledStrategies = (Object.keys(pair.strategies) as StrategyId[]).filter(
    (id) => pair.strategies[id],
  );

  const unreal = positions.reduce((acc, p) => {
    const px = price;
    const dir = p.side === "LONG" ? 1 : -1;
    return acc + (px - p.entryPrice) * p.size * dir;
  }, 0);

  return (
    <div
      className={cn(
        "glass rounded-xl p-4 transition-all",
        pair.enabled ? "neon-cyan/30" : "opacity-60",
      )}
      style={{
        boxShadow: pair.enabled
          ? "0 0 0 1px rgba(34, 211, 238, 0.15), 0 0 24px -8px rgba(34, 211, 238, 0.25)"
          : "none",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                pair.enabled ? "bg-emerald-400 animate-pulse-dot" : "bg-muted-foreground",
              )}
            />
            <span className="font-mono text-sm font-bold">{pair.symbol}</span>
          </div>
          <div className="font-mono text-xl font-bold tabular-nums mt-1">
            ${fmtPrice(price)}
          </div>
          <div
            className={cn(
              "font-mono text-[11px] tabular-nums",
              displayUp ? "text-emerald-300" : "text-red-300",
            )}
          >
            {displayUp ? "▲" : "▼"} {fmtPct(displayDelta)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 hover:bg-white/5"
              onClick={() => setOpenCfg(true)}
            >
              <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-7 w-7 hover:bg-white/5",
                pair.enabled ? "text-emerald-300" : "text-muted-foreground",
              )}
              onClick={() => togglePair(pair.symbol)}
            >
              <Power className="w-3.5 h-3.5" />
            </Button>
          </div>
          {positions.length > 0 && (
            <div
              className={cn(
                "text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded",
                unreal >= 0
                  ? "text-emerald-300 bg-emerald-500/10"
                  : "text-red-300 bg-red-500/10",
              )}
            >
              {positions.length} pos · {unreal >= 0 ? "+" : ""}
              {fmtUsd(unreal)}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[100px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={`g-${pair.symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={displayUp ? "#34d399" : "#f87171"} stopOpacity={0.45} />
                <stop offset="100%" stopColor={displayUp ? "#34d399" : "#f87171"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1 }}
              contentStyle={{
                background: "rgba(15, 18, 32, 0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "11px",
                fontFamily: "var(--font-geist-mono)",
                padding: "4px 8px",
              }}
              labelFormatter={() => ""}
              formatter={(v: number) => [`$${fmtPrice(v)}`, pair.symbol]}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={displayUp ? "#34d399" : "#f87171"}
              strokeWidth={1.5}
              fill={`url(#g-${pair.symbol})`}
              isAnimationActive={false}
            />
            {/* Position markers */}
            {positions.map((p) => (
              <ReferenceLine
                key={p.id}
                y={p.entryPrice}
                stroke={p.side === "LONG" ? "#34d399" : "#f87171"}
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Active strategies chips */}
      <div className="flex flex-wrap gap-1 mt-2">
        {enabledStrategies.length === 0 ? (
          <span className="text-[10px] text-muted-foreground italic">
            No strategies active
          </span>
        ) : (
          enabledStrategies.map((id) => {
            const strat = STRATEGIES[id];
            const count = positions.filter((p) => p.strategy === id).length;
            return (
              <span
                key={id}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
                style={{
                  backgroundColor: `${strat.color}20`,
                  color: strat.color,
                  border: `1px solid ${strat.color}40`,
                }}
              >
                {strat.name}
                {count > 0 && <span className="opacity-70">×{count}</span>}
              </span>
            );
          })
        )}
      </div>

      {/* Positions */}
      {positions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
          {positions.slice(0, 3).map((p) => {
            const dir = p.side === "LONG" ? 1 : -1;
            const pnl = (price - p.entryPrice) * p.size * dir;
            const pnlPct = (pnl / p.notional) * 100;
            const strat = STRATEGIES[p.strategy];
            return (
              <div
                key={p.id}
                className="flex items-center justify-between text-[11px] font-mono tabular-nums"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "px-1 rounded text-[9px] font-bold",
                      p.side === "LONG"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-red-500/20 text-red-300",
                    )}
                  >
                    {p.side}
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: strat.color }}
                  />
                  <span className="text-muted-foreground">
                    @ {fmtPrice(p.entryPrice)}
                  </span>
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    pnl >= 0 ? "text-emerald-300" : "text-red-300",
                  )}
                >
                  {pnl >= 0 ? "+" : ""}
                  {fmtUsd(pnl)} ({fmtPct(pnlPct)})
                </span>
              </div>
            );
          })}
          {positions.length > 3 && (
            <div className="text-[10px] text-muted-foreground text-center pt-1">
              +{positions.length - 3} more
            </div>
          )}
        </div>
      )}

      {/* Strategy config dialog */}
      <Dialog open={openCfg} onOpenChange={setOpenCfg}>
        <DialogContent className="bg-card border-white/10">
          <DialogHeader>
            <DialogTitle className="font-mono">
              {pair.symbol} · Strategy Allocation
            </DialogTitle>
          </DialogHeader>
          <PairStrategyConfig pair={pair} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PairStrategyConfig({ pair }: { pair: PairConfig }) {
  const togglePairStrategy = useTradingStore((s) => s.togglePairStrategy);
  return (
    <div className="space-y-2">
      {(Object.keys(pair.strategies) as StrategyId[]).map((id) => {
        const strat = STRATEGIES[id];
        const on = pair.strategies[id];
        return (
          <div
            key={id}
            className="flex items-center justify-between p-2 rounded-md bg-white/[0.03] border border-white/5"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: strat.color }}
              />
              <div>
                <div className="text-sm font-medium">{strat.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {strat.tagline}
                </div>
              </div>
            </div>
            <Switch checked={on} onCheckedChange={() => togglePairStrategy(pair.symbol, id)} />
          </div>
        );
      })}
    </div>
  );
}
