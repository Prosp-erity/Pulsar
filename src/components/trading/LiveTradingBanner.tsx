"use client";

import { AlertTriangle, Radio, XCircle } from "lucide-react";
import { useLiveTradingStatus } from "@/hooks/use-live-trading-status";
import { useOkxLiveAccount } from "@/hooks/use-okx-live-account";
import { useBybitLiveAccount } from "@/hooks/use-bybit-live-account";
import { useBingxLiveAccount } from "@/hooks/use-bingx-live-account";
import { useTradingStore } from "@/lib/store/trading-store";
import { cn } from "@/lib/utils";

/**
 * Sticky top banner shown whenever live trading is active.
 * Unmistakable: red pulsing glow, "LIVE TRADING ACTIVE" text, exchange
 * name + detected environment.
 *
 * Rendered once on the page above the main content so it is visible on
 * every view (Dashboard, Backtest, Strategies, Risk, Assistant, Live).
 */
export function LiveTradingBanner() {
  const snap = useLiveTradingStatus();
  const okx = useOkxLiveAccount();
  const bybit = useBybitLiveAccount();
  const bingx = useBingxLiveAccount();
  const running = useTradingStore((s) => s.running);

  // Don't render if not live
  if (!snap.isLive) return null;

  // If the live exchange is OKX, Bybit, or BingX, use the auto-detected
  // environment (probed by hitting the broker's balance API).
  // Otherwise fall back to the user's manual toggle.
  const isOkx = snap.exchangeId === "okx";
  const isBybit = snap.exchangeId === "bybit";
  const isBingx = snap.exchangeId === "bingx";
  const autoEnv =
    isOkx ? okx.environment : isBybit ? bybit.environment : isBingx ? bingx.environment : null;
  const isTestEnv =
    isOkx || isBybit || isBingx
      ? autoEnv === "demo"
      : snap.isTestEnvironment;

  // Determine the display environment label.
  let envLabel = snap.exchangeMode ?? null;
  if (isOkx && okx.environment) {
    envLabel = okx.environment === "demo" ? "Demo" : "Live";
  } else if (isBybit && bybit.environment) {
    envLabel = bybit.environment === "demo" ? "Testnet" : "Mainnet";
  } else if (isBingx && bingx.environment) {
    envLabel = bingx.environment === "demo" ? "Testnet" : "Mainnet";
  }

  const connected = snap.liveActive;
  const realFunds = connected && !isTestEnv;

  if (!connected) {
    // Live armed but no exchange connected
    return (
      <div className="w-full border-y border-white/10 bg-white/5 px-4 py-2 flex items-center gap-3 sticky top-0 z-30">
        <Radio className="w-4 h-4 text-amber-300 flex-shrink-0" />
        <div className="text-[11px] sm:text-xs font-semibold tracking-wide text-amber-200">
          Live trading armed — connect an exchange in the Live tab to start placing real orders
        </div>
      </div>
    );
  }

  // Connected + live — show the red pulsing banner
  const toneCfg = {
    border: "border-red-500/60",
    bg: "bg-red-500/10",
    accent: "text-red-300",
    glow: "shadow-[0_0_30px_-5px_rgba(239,68,68,0.6)]",
    dot: "bg-red-400 animate-pulse-dot",
  };

  const enabledAt = snap.enabledAt
    ? new Date(snap.enabledAt).toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      })
    : null;

  const headline = `LIVE TRADING ACTIVE — ${snap.primaryExchange ?? "BROKER"} ${envLabel ?? ""}`.trim();

  // Live balance (OKX, Bybit, or BingX)
  const liveAccount = isOkx ? okx : isBybit ? bybit : isBingx ? bingx : null;
  const liveBalance = liveAccount?.balance;
  const liveLoading = liveAccount?.loading && !liveBalance;
  const liveErr = liveAccount?.error;

  return (
    <div
      className={cn(
        "w-full border-y px-4 py-2.5 flex items-center gap-3 sticky top-0 z-30",
        toneCfg.border,
        toneCfg.bg,
        toneCfg.glow,
      )}
    >
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn("w-2 h-2 rounded-full", toneCfg.dot)} />
        <AlertTriangle className={cn("w-4 h-4", toneCfg.accent)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className={cn("text-[11px] sm:text-xs font-bold tracking-wider", toneCfg.accent)}>
          {headline}
          {running ? " · engine placing orders" : " · engine paused"}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono truncate">
          {enabledAt ? `enabled ${enabledAt}` : ""}
          {(isOkx || isBybit || isBingx) && liveLoading && " · fetching balance…"}
          {(isOkx || isBybit || isBingx) && liveBalance && (
            <>
              {" · "}
              <span className="text-foreground font-semibold">
                ${liveBalance.totalEqUsd.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>{" "}
              {snap.primaryExchange} account balance
              {liveBalance.uplUsd
                ? ` · uPnL $${liveBalance.uplUsd.toFixed(2)}`
                : ""}
            </>
          )}
          {(isOkx || isBybit || isBingx) && liveErr && (
            <span className="text-red-300"> · {liveErr}</span>
          )}
        </div>
      </div>
    </div>
  );
}

