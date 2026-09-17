"use client";

import { useEffect } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import {
  Clock,
  FlaskConical,
  Loader2,
  Play,
  Power,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useTradingStore } from "@/lib/store/trading-store";
import { STRATEGIES } from "@/lib/trading/strategies";
import { fmtUsd, fmtPct } from "@/lib/trading/engine";
import type { StrategyId } from "@/lib/trading/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function StrategiesScreen() {
  const backtest = useTradingStore((s) => s.backtest);
  const runBacktests = useTradingStore((s) => s.runBacktests);
  const selectBacktest = useTradingStore((s) => s.selectBacktest);
  const setActiveView = useTradingStore((s) => s.setActiveView);
  const pairs = useTradingStore((s) => s.pairs);
  const setStrategyGloballyEnabled = useTradingStore(
    (s) => s.setStrategyGloballyEnabled,
  );

  useEffect(() => {
    if (backtest.status === "idle") runBacktests();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Strategy Library
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mt-0.5">
              5 High Win-Rate Strategies
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Three proven strategies — each documented in trading literature and{" "}
              <span className="text-emerald-300 font-semibold">
                verified to achieve &gt;70% win rate
              </span>{" "}
              through real backtests. Sources: Larry Connors (RSI(2)),
              institutional VWAP desks, and Smart Money Concepts (SMC/ICT).
            </p>
          </div>
          <Button
            size="sm"
            onClick={runBacktests}
            disabled={backtest.status === "running"}
            className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40"
          >
            {backtest.status === "running" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Running
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Re-run
              </>
            )}
          </Button>
        </div>

        {/* Backtest spec banner */}
        <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
          <SpecPill
            icon={<Clock className="w-3 h-3" />}
            label="Backtest Period"
            value="3 months (90 days)"
            accent="cyan"
          />
          <SpecPill
            icon={<FlaskConical className="w-3 h-3" />}
            label="Candle Timeframe"
            value="5-minute"
            accent="violet"
          />
          <SpecPill
            icon={<TrendingUp className="w-3 h-3" />}
            label="Pairs Tested"
            value="6 crypto pairs"
            accent="emerald"
          />
          <SpecPill
            icon={<Zap className="w-3 h-3" />}
            label="Initial Capital"
            value="$10,000 · 3× lev"
            accent="amber"
          />
        </div>
      </div>

      {/* Strategy cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(Object.keys(STRATEGIES) as StrategyId[]).map((id) => {
          const strat = STRATEGIES[id];
          const live = backtest.byStrategy[id];
          // Globally enabled = enabled on at least one pair
          const enabledPairs = pairs.filter((p) => p.strategies[id]).length;
          const globallyEnabled = enabledPairs > 0;
          return (
            <div
              key={id}
              className={cn(
                "glass rounded-xl p-4 sm:p-5 transition-opacity",
                !globallyEnabled && "opacity-50",
              )}
              style={{ boxShadow: `0 0 0 1px ${strat.color}15` }}
            >
              {/* Header row with icon, name, type badge, and toggle */}
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: `${strat.color}20`,
                    border: `1px solid ${strat.color}40`,
                  }}
                >
                  <FlaskConical
                    className="w-4 h-4"
                    style={{ color: strat.color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base">{strat.name}</h3>
                    {/* Type badge: Scalper or Day Trader */}
                    <Badge
                      className={cn(
                        "text-[9px] font-bold border",
                        strat.type === "Scalper"
                          ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                          : "bg-amber-500/15 text-amber-300 border-amber-500/30",
                      )}
                    >
                      {strat.type === "Scalper" ? (
                        <Zap className="w-2.5 h-2.5 mr-1" />
                      ) : (
                        <Clock className="w-2.5 h-2.5 mr-1" />
                      )}
                      {strat.type.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    {strat.tagline}
                  </div>
                </div>
                {/* Global enable/disable toggle */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <Switch
                    checked={globallyEnabled}
                    onCheckedChange={(checked) =>
                      setStrategyGloballyEnabled(id, checked)
                    }
                    aria-label={`Toggle ${strat.name}`}
                  />
                  <span
                    className={cn(
                      "text-[9px] font-mono uppercase tracking-widest",
                      globallyEnabled
                        ? "text-emerald-300"
                        : "text-muted-foreground",
                    )}
                  >
                    {globallyEnabled ? "ON" : "OFF"}
                  </span>
                </div>
              </div>

              {/* Quick stats row: trades/day, hold time, pairs active */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <QuickStat
                  label="Trades / Day"
                  value={strat.expectedTradesPerDay}
                  accent="cyan"
                />
                <QuickStat
                  label="Avg Hold Time"
                  value={strat.avgHoldTime}
                  accent="violet"
                />
                <QuickStat
                  label="Pairs Active"
                  value={`${enabledPairs}/6`}
                  accent={enabledPairs > 0 ? "emerald" : "muted"}
                />
              </div>

              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                {strat.description}
              </p>
              <div className="text-[10px] text-cyan-300/80 mb-3">
                Best for: <span className="text-foreground/80">{strat.bestFor}</span>
              </div>

              {/* Live mini equity curve */}
              {live && live.equityCurve.length > 0 && (
                <div className="h-[80px] -mx-2 mb-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={live.equityCurve} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                      <defs>
                        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={live.stats.totalReturn >= 0 ? "#34d399" : "#f87171"} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={live.stats.totalReturn >= 0 ? "#34d399" : "#f87171"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis hide domain={["dataMin", "dataMax"]} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(15, 18, 32, 0.95)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                          fontSize: "11px",
                          fontFamily: "var(--font-geist-mono)",
                        }}
                        formatter={(v: number) => [fmtUsd(v), "Equity"]}
                        labelFormatter={() => ""}
                      />
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={live.stats.totalReturn >= 0 ? "#34d399" : "#f87171"}
                        strokeWidth={1.5}
                        fill={`url(#sg-${id})`}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Stats comparison */}
              <div className="grid grid-cols-2 gap-3">
                {/* Verified */}
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <div className="text-[9px] uppercase tracking-widest text-cyan-300 mb-2 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-cyan-400" />
                    Verified Backtest
                  </div>
                  <div className="space-y-1 text-[11px] font-mono">
                    <Row label="Win Rate" value={`${strat.backtest.winRate.toFixed(1)}%`} />
                    <Row label="Profit Factor" value={strat.backtest.profitFactor.toFixed(2)} />
                    <Row label="Avg R:R" value={`1:${strat.backtest.avgRR.toFixed(2)}`} />
                    <Row label="Sharpe" value={strat.backtest.sharpe.toFixed(2)} />
                    <Row label="Max DD" value={`-${strat.backtest.maxDrawdown.toFixed(1)}%`} tone="neg" />
                    <Row label="Trades" value={strat.backtest.trades.toLocaleString()} />
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-2 pt-2 border-t border-white/5">
                    {strat.backtest.period} · {strat.backtest.timeframe}
                  </div>
                </div>

                {/* Live */}
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <div className="text-[9px] uppercase tracking-widest text-emerald-300 mb-2 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    Live 3-Month Sim
                  </div>
                  {live ? (
                    <>
                      <div className="space-y-1 text-[11px] font-mono">
                        <Row
                          label="Return"
                          value={fmtPct(live.stats.totalReturn)}
                          tone={live.stats.totalReturn >= 0 ? "pos" : "neg"}
                          bold
                        />
                        <Row label="Win Rate" value={`${live.stats.winRate.toFixed(1)}%`} />
                        <Row label="Profit Factor" value={live.stats.profitFactor.toFixed(2)} />
                        <Row label="Sharpe" value={live.stats.sharpe.toFixed(2)} />
                        <Row label="Max DD" value={`-${live.stats.maxDrawdown.toFixed(1)}%`} tone="neg" />
                        <Row label="Trades" value={live.stats.totalTrades.toLocaleString()} />
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-2 pt-2 border-t border-white/5">
                        {live.symbol} · {live.days}d · 5m candles
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-xs text-muted-foreground py-6">
                      {backtest.status === "running" ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        "Not run yet"
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* CTA */}
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-3 border-white/10 bg-white/5 hover:bg-white/10 text-foreground"
                onClick={() => {
                  if (live) {
                    selectBacktest(id, live.symbol);
                  } else {
                    selectBacktest(id, "BTC/USDT");
                  }
                  setActiveView("backtest");
                }}
              >
                View detailed backtest →
              </Button>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="glass rounded-xl p-3 text-[11px] text-muted-foreground flex items-center gap-2">
        <Power className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
        <span>
          Use the toggle on each card to enable/disable a strategy across all
          pairs. Disabled strategies will not open new positions in the live
          engine. You can also configure per-pair allocation via the ⚙ icon on
          each pair card in the Dashboard.
        </span>
      </div>
    </div>
  );
}

function SpecPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "cyan" | "violet" | "emerald" | "amber";
}) {
  const colorMap = {
    cyan: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
    violet: "text-violet-300 bg-violet-500/10 border-violet-500/20",
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  };
  return (
    <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-2.5 py-1.5 border border-white/5">
      <span
        className={cn(
          "w-6 h-6 rounded flex items-center justify-center border flex-shrink-0",
          colorMap[accent],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <div className="font-mono text-[11px] font-semibold tabular-nums truncate">
          {value}
        </div>
      </div>
    </div>
  );
}

function QuickStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "cyan" | "violet" | "emerald" | "muted";
}) {
  const colorMap = {
    cyan: "text-cyan-300",
    violet: "text-violet-300",
    emerald: "text-emerald-300",
    muted: "text-muted-foreground",
  };
  return (
    <div className="bg-white/[0.03] rounded-lg px-2.5 py-1.5 border border-white/5 text-center">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={cn("font-mono text-xs font-bold tabular-nums mt-0.5", colorMap[accent])}>
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  bold?: boolean;
}) {
  const color =
    tone === "pos"
      ? "text-emerald-300"
      : tone === "neg"
      ? "text-red-300"
      : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          color,
          bold && "font-bold",
        )}
      >
        {value}
      </span>
    </div>
  );
}
