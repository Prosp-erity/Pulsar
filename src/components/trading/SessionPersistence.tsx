"use client";

import { useEffect, useState } from "react";
import { Database, RotateCcw, Trash2 } from "lucide-react";
import { useTradingStore } from "@/lib/store/server-trading-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useHydrated } from "@/hooks/use-hydrated";

export function SessionPersistence() {
  const hydrated = useHydrated();
  const lastSavedAt = useTradingStore((s) => s.lastSavedAt);
  const clearHistory = useTradingStore((s) => s.clearHistory);
  const resetEngine = useTradingStore((s) => s.resetEngine);
  const trades = useTradingStore((s) => s.trades.length);
  const positions = useTradingStore((s) => s.positions.length);
  const realizedPnl = useTradingStore((s) => s.realizedPnl);
  const engineStatus = useTradingStore((s) => s.engineStatus);
  const [, force] = useState(0);

  // Tick every 5s so "saved Xs ago" stays fresh
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const hasHistory = hydrated && (trades > 0 || positions > 0 || realizedPnl !== 0);
  const displaySaved = hydrated && lastSavedAt > 0;
  const displayStatus = engineStatus?.ticksProcessed !== undefined;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5">
        {/* Save indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/5 text-[10px] font-mono text-muted-foreground cursor-default">
              <Database className="w-3 h-3 text-cyan-300" />
              <span className="hidden sm:inline">
                {displaySaved ? `saved ${timeAgoShort(lastSavedAt)}` : hydrated ? "no save yet" : "\u2014"}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  displaySaved && Date.now() - lastSavedAt < 10000
                    ? "bg-emerald-400"
                    : displaySaved
                    ? "bg-amber-400"
                    : "bg-muted-foreground"
                }`}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-card border-white/10 text-xs">
            <div className="space-y-1 font-mono">
              <div className="text-cyan-300 font-semibold">Server Engine Status</div>
              {displayStatus && (
                <>
                  <div>Engine: {engineStatus?.running ? "RUNNING" : "STOPPED"}</div>
                  <div>Ticks: {engineStatus?.ticksProcessed ?? 0}</div>
                  <div>Active positions: {engineStatus?.activePositions ?? 0}</div>
                  <div>Total trades: {engineStatus?.totalTrades ?? 0}</div>
                </>
              )}
              <div>
                Last saved:{" "}
                {hydrated && lastSavedAt > 0
                  ? new Date(lastSavedAt).toLocaleTimeString("en-US", { hour12: false })
                  : hydrated ? "never" : "\u2014"}
              </div>
              <div>Trades in memory: {hydrated ? trades : "\u2014"}</div>
              <div>Open positions: {hydrated ? positions : "\u2014"}</div>
              <div>Realized P&L: {hydrated ? `$${realizedPnl.toFixed(2)}` : "\u2014"}</div>
              <div className="text-muted-foreground pt-1 border-t border-white/10 mt-1">
                Server engine runs continuously. State persists across page reloads.
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Clear history with confirmation */}
        {hasHistory && (
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 hover:bg-red-500/20 hover:text-red-300 text-muted-foreground"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-card border-white/10 text-xs">
                Clear session history
              </TooltipContent>
            </Tooltip>
            <AlertDialogContent className="bg-card border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle>Clear session history?</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  This will permanently delete all saved trades, positions, P&L,
                  and equity curve history from the server. Your pair
                  configurations and strategy toggles will be preserved. This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/10 bg-white/5 hover:bg-white/10">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={clearHistory}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40"
                >
                  Clear history
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </TooltipProvider>
  );
}

function timeAgoShort(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
