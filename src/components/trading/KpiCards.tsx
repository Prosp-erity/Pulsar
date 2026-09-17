"use client";

import {
  TrendingUp,
  TrendingDown,
  Target,
  Wallet,
  Layers,
  Gauge,
} from "lucide-react";
import { useTradingStore, selectEquity, selectUnrealizedPnl } from "@/lib/store/trading-store";
import { fmtUsd, fmtPct } from "@/lib/trading/engine";
import { cn } from "@/lib/utils";

export function KpiCards() {
  const starting = useTradingStore((s) => s.startingBalance);
  const equity = useTradingStore(selectEquity);
  const unreal = useTradingStore(selectUnrealizedPnl);
  const realized = useTradingStore((s) => s.realizedPnl);
  const positions = useTradingStore((s) => s.positions);
  const trades = useTradingStore((s) => s.trades);
  const prices = useTradingStore((s) => s.prices);

  const openNotional = positions.reduce((acc, p) => {
    const px = prices[p.pair] ?? p.entryPrice;
    return acc + px * p.size;
  }, 0);

  const wins = trades.filter((t) => t.outcome === "WIN").length;
  const losses = trades.filter((t) => t.outcome === "LOSS").length;
  const total = wins + losses;
  const winRate = total > 0 ? (wins / total) * 100 : 0;

  const totalReturn = ((equity - starting) / starting) * 100;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiCard
        icon={<Wallet className="w-4 h-4" />}
        label="Equity"
        value={fmtUsd(equity)}
        sub={`Start ${fmtUsd(starting)}`}
        tone={equity >= starting ? "pos" : "neg"}
        accent="cyan"
      />
      <KpiCard
        icon={totalReturn >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        label="Total Return"
        value={fmtPct(totalReturn)}
        sub={`${fmtUsd(equity - starting)}`}
        tone={totalReturn >= 0 ? "pos" : "neg"}
      />
      <KpiCard
        icon={<Layers className="w-4 h-4" />}
        label="Unrealized"
        value={fmtUsd(unreal)}
        sub={`${positions.length} open positions`}
        tone={unreal >= 0 ? "pos" : "neg"}
        accent="violet"
      />
      <KpiCard
        icon={<Gauge className="w-4 h-4" />}
        label="Realized"
        value={fmtUsd(realized)}
        sub={`${trades.length} closed trades`}
        tone={realized >= 0 ? "pos" : "neg"}
        accent="emerald"
      />
      <KpiCard
        icon={<Target className="w-4 h-4" />}
        label="Win Rate"
        value={`${winRate.toFixed(1)}%`}
        sub={`${wins}W · ${losses}L`}
        tone={winRate >= 50 ? "pos" : "neg"}
      />
      <KpiCard
        icon={<Wallet className="w-4 h-4" />}
        label="Open Exposure"
        value={fmtUsd(openNotional)}
        sub={`${(openNotional / Math.max(1, equity) * 100).toFixed(0)}% of equity`}
        accent="amber"
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: "pos" | "neg";
  accent?: "cyan" | "violet" | "emerald" | "amber";
}) {
  const accentClass =
    accent === "cyan"
      ? "text-cyan-300 bg-cyan-500/10 border-cyan-500/20"
      : accent === "violet"
      ? "text-violet-300 bg-violet-500/10 border-violet-500/20"
      : accent === "emerald"
      ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
      : accent === "amber"
      ? "text-amber-300 bg-amber-500/10 border-amber-500/20"
      : "text-muted-foreground bg-white/5 border-white/10";
  const valueColor =
    tone === "pos"
      ? "text-emerald-300"
      : tone === "neg"
      ? "text-red-300"
      : "text-foreground";

  return (
    <div className="glass rounded-xl p-4 hover:bg-white/[0.06] transition-colors group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center border",
            accentClass,
          )}
        >
          {icon}
        </span>
      </div>
      <div className={cn("font-mono text-xl font-bold tabular-nums", valueColor)}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1 font-mono tabular-nums">
        {sub}
      </div>
    </div>
  );
}
