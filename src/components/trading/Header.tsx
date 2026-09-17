"use client";

import { Activity, Pause, Play, RotateCcw, Zap } from "lucide-react";
import { useTradingStore, selectEquity, selectUnrealizedPnl } from "@/lib/store/trading-store";
import { fmtUsd, fmtPct } from "@/lib/trading/engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TopTabs } from "./Navigation";
import { SessionPersistence } from "./SessionPersistence";
import { useHydrated } from "@/hooks/use-hydrated";

export function Header() {
  const hydrated = useHydrated();
  const running = useTradingStore((s) => s.running);
  const toggleEngine = useTradingStore((s) => s.toggleEngine);
  const resetEngine = useTradingStore((s) => s.resetEngine);
  const equity = useTradingStore(selectEquity);
  const unreal = useTradingStore(selectUnrealizedPnl);
  const starting = useTradingStore((s) => s.startingBalance);
  const lastTickAt = useTradingStore((s) => s.lastTickAt);
  const positionsCount = useTradingStore((s) => s.positions.length);

  const totalReturn = ((equity - starting) / starting) * 100;

  // Until hydrated, show neutral placeholders that match server output.
  // This prevents hydration mismatch when localStorage loads different values.
  const displayEquity = hydrated ? fmtUsd(equity) : "—";
  const displayUnreal = hydrated ? fmtUsd(unreal) : "—";
  const displayReturn = hydrated ? fmtPct(totalReturn) : "—";
  const displayOpen = hydrated ? `${positionsCount}` : "—";
  const displayTime = hydrated
    ? new Date(lastTickAt).toLocaleTimeString("en-US", { hour12: false })
    : "—";

  return (
    <header className="sticky top-0 z-40 glass-strong border-b border-white/10">
      <div className="px-3 sm:px-6 py-2.5 sm:py-3 max-w-[1800px] mx-auto">
        {/* Top row: logo + status + stats + actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-cyan-400 via-emerald-400 to-violet-500 flex items-center justify-center neon-cyan">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-black" strokeWidth={2.5} />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="font-mono text-sm font-bold tracking-tight">
                Pul<span className="text-cyan-400 text-glow">sar</span>
              </div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest">
                Scalping Engine v2.1
              </div>
            </div>
          </div>

          {/* Status pill — use hydrated to prevent mismatch (running is
              false on server but may be true on client from localStorage) */}
          <div
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium border flex-shrink-0 ${
              hydrated && running
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-white/5 border-white/10 text-muted-foreground"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                hydrated && running ? "bg-emerald-400 animate-pulse-dot" : "bg-muted-foreground"
              }`}
            />
            <span className="hidden sm:inline">{running ? "ENGINE LIVE" : "PAUSED"}</span>
            <span className="sm:hidden">{running ? "LIVE" : "IDLE"}</span>
          </div>

          {/* Stats (desktop) */}
          <div className="hidden lg:flex items-center gap-4 ml-auto">
            <Stat label="EQUITY" value={displayEquity} accent="cyan" />
            <Stat
              label="UNREALIZED"
              value={displayUnreal}
              tone={hydrated && unreal >= 0 ? "pos" : hydrated ? "neg" : undefined}
            />
            <Stat
              label="RETURN"
              value={displayReturn}
              tone={hydrated && totalReturn >= 0 ? "pos" : hydrated ? "neg" : undefined}
            />
            <Stat label="OPEN" value={displayOpen} accent="violet" />
            <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
              <Activity className="w-3 h-3 inline mr-1" />
              {displayTime}
            </div>
          </div>

          {/* Mobile compact stats */}
          <div className="flex lg:hidden items-center gap-1.5 ml-auto">
            <span className="font-mono text-xs font-semibold tabular-nums text-cyan-300">
              {displayEquity}
            </span>
            <span
              className={`font-mono text-[10px] tabular-nums ${
                !hydrated
                  ? "text-muted-foreground"
                  : unreal >= 0
                  ? "text-emerald-300"
                  : "text-red-300"
              }`}
            >
              {hydrated && unreal >= 0 ? "+" : ""}
              {displayUnreal}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              size="sm"
              variant={running ? "destructive" : "default"}
              onClick={toggleEngine}
              className={`h-8 px-2.5 sm:px-3 ${
                running
                  ? "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40"
                  : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 neon-emerald"
              }`}
            >
              {running ? (
                <>
                  <Pause className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Stop</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Start</span>
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={resetEngine}
              className="h-8 w-8 p-0 border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Desktop: nav tabs row */}
        <div className="hidden md:flex items-center justify-between mt-2 pt-2 border-t border-white/5">
          <TopTabs />
          <div className="flex items-center gap-3">
            <SessionPersistence />
            <div className="text-[10px] text-muted-foreground font-mono">
              5 strategies (&gt;70% WR) · simulated market
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  tone,
  accent,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  accent?: "cyan" | "violet";
}) {
  const color =
    tone === "pos"
      ? "text-emerald-300"
      : tone === "neg"
      ? "text-red-300"
      : accent === "cyan"
      ? "text-cyan-300"
      : accent === "violet"
      ? "text-violet-300"
      : "text-foreground";
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-sm font-semibold tabular-nums ${color}`}>
        {value}
      </span>
    </div>
  );
}
