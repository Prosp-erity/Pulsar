"use client";

import { Radio } from "lucide-react";
import { useTradingStore } from "@/lib/store/trading-store";
import { STRATEGIES } from "@/lib/trading/strategies";
import { timeAgo } from "@/lib/trading/engine";
import { cn } from "@/lib/utils";

export function SignalFeed() {
  const signals = useTradingStore((s) => s.signals);

  return (
    <div className="glass rounded-xl flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Signal Feed
          </div>
          <div className="font-semibold text-sm">Live Strategy Signals</div>
        </div>
        <Radio className="w-4 h-4 text-cyan-300 animate-pulse-dot" />
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        {signals.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No signals yet. Start the engine to receive live signals.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {signals.map((s, i) => {
              const strat = STRATEGIES[s.strategy];
              return (
                <div
                  key={`${s.ts}-${i}`}
                  className="px-4 py-2.5 hover:bg-white/[0.03] transition border-l-2"
                  style={{ borderLeftColor: strat.color }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono",
                          s.side === "LONG"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300",
                        )}
                      >
                        {s.side}
                      </span>
                      <span className="font-mono text-xs font-semibold">
                        {s.pair}
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
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {timeAgo(s.ts)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {s.reason}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, s.strength * 100)}%`,
                          backgroundColor: strat.color,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                      {(s.strength * 100).toFixed(0)}%
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
