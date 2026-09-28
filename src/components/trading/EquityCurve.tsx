"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTradingStore } from "@/lib/store/trading-store";
import { fmtUsd } from "@/lib/trading/engine";

export function EquityCurve() {
  const curve = useTradingStore((s) => s.equityCurve);
  const starting = useTradingStore((s) => s.startingBalance);

  const data = useMemo(
    () =>
      curve.map((p, i) => ({
        i,
        t: p.t,
        v: Math.round(p.v * 100) / 100,
      })),
    [curve],
  );

  const min = Math.min(starting, ...data.map((d) => d.v));
  const max = Math.max(starting, ...data.map((d) => d.v));
  const last = data[data.length - 1]?.v ?? starting;
  const delta = last - starting;
  const up = delta >= 0;

  return (
    <div className="glass rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-start justify-between mb-3 flex-shrink-0">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Equity Curve
          </div>
          <div className="font-mono text-2xl font-bold tabular-nums mt-1">
            {fmtUsd(last)}
          </div>
        </div>
        <div
          className={`text-right font-mono text-sm tabular-nums ${
            up ? "text-emerald-300" : "text-red-300"
          }`}
        >
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Net P&L
          </div>
          <div className="font-semibold">
            {up ? "+" : ""}
            {fmtUsd(delta)}
          </div>
          <div className="text-[11px]">
            ({up ? "+" : ""}
            {((delta / starting) * 100).toFixed(2)}%)
          </div>
        </div>
      </div>
      {/* Fixed 240px chart height — avoids the "empty void" UX issue where
          a stretched chart container with sparse data looks broken. */}
      <div className="h-[240px] -mx-2 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={up ? "#34d399" : "#f87171"} stopOpacity={0.5} />
                <stop offset="100%" stopColor={up ? "#34d399" : "#f87171"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="i" hide />
            <YAxis
              domain={["dataMin", "dataMax"]}
              hide
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1 }}
              contentStyle={{
                background: "rgba(15, 18, 32, 0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "12px",
                fontFamily: "var(--font-geist-mono)",
              }}
              labelFormatter={() => ""}
              formatter={(v: number) => [fmtUsd(v), "Equity"]}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={up ? "#34d399" : "#f87171"}
              strokeWidth={2}
              fill="url(#eqGrad)"
              isAnimationActive={false}
              baseValue="dataMin"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
