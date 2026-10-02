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
import { Settings2, Layers } from "lucide-react";
import { useTradingStore } from "@/lib/store/server-trading-store";
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
  const togglePair = useTradingStore((s) => s.togglePair);
  const enabledCount = pairs.filter((p) => p.enabled).length;
  const totalCount = pairs.length;
  const allOn = enabledCount === totalCount;

  // Bulk toggle: if any are off, turn all on. If all on, turn all off.
  const toggleAll = () => {
    const target = !allOn;
    for (const p of pairs) {
      if (p.enabled !== target) togglePair(p.symbol);
    }
  };

  return (
    <div>
      {/* Pair selection header bar — visible above the grid so the user
          immediately sees that they can tap to enable/disable individual
          pairs. Includes pair chips for quick toggle + a Select All/None
          bulk button + the active count. */}
      <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 glass rounded-xl border border-white/5 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-300" />
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Trading Pairs · tap to toggle
            </div>
            <div className="text-sm font-semibold">
              {enabledCount} of {totalCount} active
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Pair chip row — tap any chip to toggle that pair */}
          <div className="hidden md:flex items-center gap-1.5 mr-2">
            {pairs.map((p) => (
              <button
                key={p.symbol}
                onClick={() => togglePair(p.symbol)}
                className={cn(
                  "text-[10px] font-mono px-2 py-0.5 rounded border transition",
                  p.enabled
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10",
                )}
                title={p.enabled ? `Tap to pause ${p.symbol}` : `Tap to enable ${p.symbol}`}
              >
                {p.symbol.split("/")[0]}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleAll}
            className={cn(
              "h-7 text-[10px] uppercase tracking-wider",
              allOn
                ? "border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300"
                : "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300",
            )}
          >
            {allOn ? "Turn All Off" : "Enable All"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {pairs.map((p) => (
          <PairCard key={p.symbol} pair={p} />
        ))}
      </div>
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
        "glass rounded-xl p-4 transition-all cursor-pointer relative",
        pair.enabled
          ? "ring-1 ring-emerald-500/30 hover:ring-emerald-500/50"
          : "opacity-60 hover:opacity-80 ring-1 ring-white/5",
      )}
      onClick={() => togglePair(pair.symbol)}
      title={pair.enabled ? `Tap to pause ${pair.symbol}` : `Tap to enable ${pair.symbol}`}
    >
      {/* ENABLED / PAUSED badge top-right corner */}
      <div className="absolute top-3 right-3">
        <span
          className={cn(
            "text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border",
            pair.enabled
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              : "bg-white/5 text-muted-foreground border-white/10",
          )}
        >
          {pair.enabled ? "● TRADING" : "○ PAUSED"}
        </span>
      </div>

      {/* Settings gear button — opens per-pair strategy config dialog.
          Stops propagation so it doesn't trigger the card's toggle. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpenCfg(true);
        }}
        className="absolute top-3 right-20 text-muted-foreground hover:text-cyan-300 transition opacity-60 hover:opacity-100"
        title="Configure strategies for this pair"
      >
        <Settings2 className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start justify-between mb-3 pr-24">
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
      <div className="h-[100px] -mx-2" onClick={(e) => e.stopPropagation()}>
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
        <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
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
