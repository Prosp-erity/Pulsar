"use client";

import { BarChart3, Bot, LayoutDashboard, Layers, Plug, Shield } from "lucide-react";
import { useTradingStore } from "@/lib/store/trading-store";
import { useLiveTradingStatus } from "@/hooks/use-live-trading-status";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type View = "dashboard" | "backtest" | "strategies" | "live" | "risk" | "assistant";

const NAV_ITEMS: { id: View; label: string; icon: ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "backtest", label: "Backtest", icon: <BarChart3 className="w-4 h-4" /> },
  { id: "strategies", label: "Strategies", icon: <Layers className="w-4 h-4" /> },
  { id: "risk", label: "Risk", icon: <Shield className="w-4 h-4" /> },
  { id: "assistant", label: "AI", icon: <Bot className="w-4 h-4" /> },
  { id: "live", label: "Live", icon: <Plug className="w-4 h-4" /> },
];

export function BottomNav() {
  const activeView = useTradingStore((s) => s.activeView);
  const setActiveView = useTradingStore((s) => s.setActiveView);
  const live = useLiveTradingStatus();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass-strong border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-6">
        {NAV_ITEMS.map((item) => {
          const active = activeView === item.id;
          const isLiveTab = item.id === "live";
          const liveOn = live.isLive && live.liveActive;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 transition-colors relative",
                active ? "text-cyan-300" : "text-muted-foreground",
                isLiveTab && liveOn && !active && "text-red-300",
              )}
            >
              <span className={cn("transition-transform relative", active && "scale-110")}>
                {item.icon}
                {isLiveTab && liveOn && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-red-400 animate-pulse-dot shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
                )}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
              {active && (
                <span className="absolute top-0 h-0.5 w-10 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function TopTabs() {
  const activeView = useTradingStore((s) => s.activeView);
  const setActiveView = useTradingStore((s) => s.setActiveView);
  const live = useLiveTradingStatus();

  return (
    <div className="hidden md:flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const active = activeView === item.id;
        const isLiveTab = item.id === "live";
        const liveOn = live.isLive && live.liveActive;
        return (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors relative",
              active
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              isLiveTab && liveOn && !active && "text-red-300 hover:text-red-200",
              isLiveTab && liveOn && "bg-red-500/10",
            )}
          >
            <span className="relative">
              {item.icon}
              {isLiveTab && liveOn && (
                <span className="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse-dot" />
              )}
            </span>
            {item.label}
            {isLiveTab && liveOn && (
              <span className="ml-1 px-1 py-0 rounded text-[8px] font-bold tracking-wider bg-red-500/30 text-red-200">
                LIVE
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
