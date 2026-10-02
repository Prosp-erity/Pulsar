"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/trading/Header";
import { PriceTicker } from "@/components/trading/PriceTicker";
import { KpiCards } from "@/components/trading/KpiCards";
import { EquityCurve } from "@/components/trading/EquityCurve";
import { StrategyPanel } from "@/components/trading/StrategyPanel";
import { PairGrid } from "@/components/trading/PairGrid";
import { PositionsTable } from "@/components/trading/PositionsTable";
import { TradeFeed } from "@/components/trading/TradeFeed";
import { SignalFeed } from "@/components/trading/SignalFeed";
import { EngineSettingsPanel } from "@/components/trading/EngineSettingsPanel";
import { BacktestScreen } from "@/components/trading/BacktestScreen";
import { StrategiesScreen } from "@/components/trading/StrategiesScreen";
import { BottomNav } from "@/components/trading/Navigation";
import { ClientOnly } from "@/components/trading/ClientOnly";
import { LiveTradingConfig } from "@/components/trading/LiveTradingConfig";
import { RiskManagementScreen } from "@/components/trading/RiskManagementScreen";
import { AssistantPanel } from "@/components/trading/AssistantPanel";
import { LiveTradingBanner } from "@/components/trading/LiveTradingBanner";
import { AuthSplash } from "@/components/trading/AuthSplash";
import { LiveOrderBridgeStatus } from "@/components/trading/LiveOrderBridgeStatus";
import { useTradingStore, useEngineStateSync } from "@/lib/store/server-trading-store";
import Link from "next/link";
import { ArrowLeft, Home as HomeIcon } from "lucide-react";

export default function Home() {
  const router = useRouter();
  // Check auth via useSyncExternalStore (avoids setState-in-effect lint error)
  const authed = useSyncExternalStore(
    () => () => {},
    () => {
      if (typeof window === "undefined") return false;
      return sessionStorage.getItem("pulsar_auth") === "true" ||
             localStorage.getItem("pulsar_auth") === "true";
    },
    () => false,
  );
  const startEngine = useTradingStore((s) => s.startEngine);
  const stopEngine = useTradingStore((s) => s.stopEngine);
  const runBacktests = useTradingStore((s) => s.runBacktests);
  const backtestStatus = useTradingStore((s) => s.backtest.status);
  const activeView = useTradingStore((s) => s.activeView);
  const clearHistory = useTradingStore((s) => s.clearHistory);

  // Redirect to login if not authenticated — give the splash screen
  // enough air-time (~500ms) to actually be seen by the user.
  useEffect(() => {
    if (!authed) {
      const t = setTimeout(() => router.push("/login"), 500);
      return () => clearTimeout(t);
    }
  }, [authed, router]);

  // Sync with server engine state
  useEngineStateSync();

  // Auto-run backtests on first load
  useEffect(() => {
    if (!authed) return;
    if (backtestStatus === "idle") {
      const t = setTimeout(() => runBacktests(), 800);
      return () => clearTimeout(t);
    }
  }, [authed, backtestStatus, runBacktests]);

  if (!authed) {
    return <AuthSplash message="Authenticating" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <ClientOnly fallback={null}>
        <LiveTradingBanner />
      </ClientOnly>
      <ClientOnly fallback={<div className="h-10 border-y border-white/5 bg-black/20" />}>
        <PriceTicker />
      </ClientOnly>

      <main className="flex-1 p-3 sm:p-4 md:p-6 pb-20 md:pb-6 max-w-[1800px] w-full mx-auto">
        <ClientOnly fallback={<AuthSplash message="Loading trading engine" />}>
          {activeView === "dashboard" && <DashboardView />}
          {activeView === "backtest" && <BacktestScreen />}
          {activeView === "strategies" && <StrategiesScreen />}
          {activeView === "risk" && <RiskManagementScreen />}
          {activeView === "assistant" && (
            <div className="h-[calc(100vh-140px)]">
              <AssistantPanel />
            </div>
          )}
          {activeView === "live" && <LiveTradingConfig />}
        </ClientOnly>
      </main>

      <footer className="hidden md:block mt-auto border-t border-white/5 bg-black/20 px-6 py-3">
        <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
          <div className="flex items-center gap-4">
            <span>
              Pulsar Engine · 5 high-win-rate strategies (&gt;70% WR) · 6 pairs · simulated market
            </span>
            <Link
              href="/landing"
              className="flex items-center gap-1 text-cyan-300/60 hover:text-cyan-300 transition"
            >
              <HomeIcon className="w-3 h-3" />
              Landing
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              All systems nominal
            </span>
            <span>⚠ Educational simulation — not financial advice</span>
          </div>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}

function DashboardView() {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* KPI Row */}
      <KpiCards />

      {/* Live Order Bridge status — only shown when live on a supported exchange */}
      <LiveOrderBridgeStatus />

      {/* Top section: Equity curve + Strategy panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:items-stretch">
        <div className="lg:col-span-2 min-h-[260px]">
          <EquityCurve />
        </div>
        <div className="lg:col-span-1">
          <StrategyPanel />
        </div>
      </div>

      {/* Middle section: Pairs + right rail */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="xl:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Multi-Pair Trading Grid
            </h2>
            <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
              click ⚙ to configure strategies per pair
            </span>
          </div>
          <PairGrid />
        </div>
        <div className="xl:col-span-1 space-y-3 sm:space-y-4">
          <EngineSettingsPanel />
          <SignalFeed />
        </div>
      </div>

      {/* Bottom section: Positions table + Trade feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="h-[360px] sm:h-[420px]">
          <PositionsTable />
        </div>
        <div className="h-[360px] sm:h-[420px]">
          <TradeFeed />
        </div>
      </div>
    </div>
  );
}
