"use client";

import {
  TrendingUp,
  TrendingDown,
  Target,
  Wallet,
  Layers,
  Gauge,
  AlertCircle,
} from "lucide-react";
import { useTradingStore, selectEquity, selectUnrealizedPnl } from "@/lib/store/server-trading-store";
import { fmtUsd, fmtPct } from "@/lib/trading/engine";
import { useLiveTradingStatus } from "@/hooks/use-live-trading-status";
import { useOkxLiveAccount } from "@/hooks/use-okx-live-account";
import { useBybitLiveAccount } from "@/hooks/use-bybit-live-account";
import { useBingxLiveAccount } from "@/hooks/use-bingx-live-account";
import { cn } from "@/lib/utils";

export function KpiCards() {
  const starting = useTradingStore((s) => s.startingBalance);
  const equity = useTradingStore(selectEquity);
  const unreal = useTradingStore(selectUnrealizedPnl);
  const realized = useTradingStore((s) => s.realizedPnl);
  const positions = useTradingStore((s) => s.positions);
  const trades = useTradingStore((s) => s.trades);
  const prices = useTradingStore((s) => s.prices);
  const live = useLiveTradingStatus();
  const okx = useOkxLiveAccount();
  const bybit = useBybitLiveAccount();
  const bingx = useBingxLiveAccount();

  const isOkxLive = !!(live.liveActive && live.exchangeId === "okx");
  const isBybitLive = !!(live.liveActive && live.exchangeId === "bybit");
  const isBingxLive = !!(live.liveActive && live.exchangeId === "bingx");
  const brokerLive = isOkxLive || isBybitLive || isBingxLive;
  const brokerAccount = isOkxLive ? okx : isBybitLive ? bybit : isBingxLive ? bingx : null;
  const brokerHasBalance = brokerLive && brokerAccount?.balance;
  const brokerRealBalance = brokerHasBalance ? brokerAccount!.balance!.totalEqUsd : null;
  const brokerRealUpl = brokerHasBalance ? brokerAccount!.balance!.uplUsd : null;
  const brokerFillsCount = brokerLive ? brokerAccount!.fills.length : 0;
  const brokerOpenPositions = brokerLive ? brokerAccount!.positions.length : 0;

  // When live broker is connected, override the simulated values with the real ones
  const displayEquity = brokerRealBalance != null ? brokerRealBalance : equity;
  const displayUnreal = brokerRealUpl != null ? brokerRealUpl : unreal;
  const displayRealized = brokerLive ? 0 : realized;
  const displayTradesCount = brokerLive ? brokerFillsCount : trades.length;
  const displayOpenCount = brokerLive ? brokerOpenPositions : positions.length;
  const displayTotalReturn =
    brokerRealBalance != null
      ? ((brokerRealBalance - starting) / starting) * 100
      : ((equity - starting) / starting) * 100;

  const wins = trades.filter((t) => t.outcome === "WIN").length;
  const losses = trades.filter((t) => t.outcome === "LOSS").length;
  const total = wins + losses;
  const winRate = total > 0 ? (wins / total) * 100 : 0;

  const openNotional = positions.reduce((acc, p) => {
    const px = prices[p.pair] ?? p.entryPrice;
    return acc + px * p.size;
  }, 0);

  const isLive = live.isLive && live.liveActive;

  return (
    <div className="space-y-2">
      {/* Live status header — only shown when actually live on a connected exchange */}
      {isLive && (
        <div
          className={cn(
            "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs font-medium",
            "bg-red-500/10 border-red-500/40 text-red-300 shadow-[0_0_25px_-10px_rgba(239,68,68,0.6)]",
          )}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
            Trading LIVE on {live.primaryExchange}
            {brokerLive && live.exchangeId && brokerAccount?.environment
              ? brokerAccount.environment === "demo"
                ? ` (${live.primaryExchange} Testnet — auto-detected)`
                : ` (${live.primaryExchange} Live — auto-detected)`
              : ` ${live.exchangeMode ?? ""}`}
            {brokerLive && brokerAccount?.loading && !brokerHasBalance && " · fetching balance…"}
          </span>
          <span className="font-mono text-[10px] opacity-80">
            {brokerLive
              ? brokerAccount?.error
                ? `error: ${brokerAccount.error}`
                : brokerHasBalance
                  ? `real broker balance · last sync ${new Date(brokerAccount?.lastUpdated ?? Date.now()).toLocaleTimeString()}`
                  : "connecting…"
              : "real broker orders"}
          </span>
        </div>
      )}
      {/* Error banner for OKX connection issues */}
      {brokerLive && brokerAccount?.error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/5 text-red-300 text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{live.primaryExchange} API error: {brokerAccount.error}. Check your API key/secret and IP whitelist.</span>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          icon={<Wallet className="w-4 h-4" />}
          label={isLive ? "Live Equity" : "Equity"}
          value={fmtUsd(displayEquity)}
          sub={brokerLive && brokerAccount?.loading ? "fetching…" : `Start ${fmtUsd(starting)}`}
          tone={displayEquity >= starting ? "pos" : "neg"}
          accent="cyan"
          liveBadge={isLive}
        />
        <KpiCard
          icon={displayTotalReturn >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          label="Total Return"
          value={fmtPct(displayTotalReturn)}
          sub={`${fmtUsd(displayEquity - starting)}`}
          tone={displayTotalReturn >= 0 ? "pos" : "neg"}
          liveBadge={isLive}
        />
        <KpiCard
          icon={<Layers className="w-4 h-4" />}
          label="Unrealized"
          value={fmtUsd(displayUnreal)}
          sub={`${displayOpenCount} open positions`}
          tone={displayUnreal >= 0 ? "pos" : "neg"}
          accent="violet"
          liveBadge={isLive}
        />
        <KpiCard
          icon={<Gauge className="w-4 h-4" />}
          label="Realized"
          value={brokerLive ? "N/A" : fmtUsd(displayRealized)}
          sub={`${displayTradesCount} closed ${brokerLive ? "fills" : "trades"}`}
          tone={brokerLive ? undefined : displayRealized >= 0 ? "pos" : "neg"}
          accent="emerald"
          liveBadge={isLive}
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
          sub={`${(openNotional / Math.max(1, displayEquity) * 100).toFixed(0)}% of equity`}
          accent="amber"
          liveBadge={isLive}
        />
      </div>
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
  liveBadge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: "pos" | "neg";
  accent?: "cyan" | "violet" | "emerald" | "amber";
  liveBadge?: boolean;
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
    <div
      className={cn(
        "rounded-xl p-4 hover:bg-white/[0.06] transition-colors group border",
        liveBadge
          ? "glass-strong border-red-500/40 bg-red-500/[0.04] shadow-[0_0_25px_-12px_rgba(239,68,68,0.6)]"
          : "glass border-white/5",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1">
          {liveBadge && (
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold tracking-wider border bg-red-500/20 text-red-200 border-red-500/40">
              <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse-dot" />
              LIVE
            </span>
          )}
          <span
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center border",
              accentClass,
            )}
          >
            {icon}
          </span>
        </div>
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
