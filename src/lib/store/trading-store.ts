// OBSOLETE: This file is now deprecated.
// The trading engine now runs server-side.
// All trading state comes from the server via API endpoints.
// Use src/lib/store/server-trading-store.ts instead.

"use client";

// This file is kept for backward compatibility during migration.
// It will be removed in a future cleanup.

export {
  useTradingStore,
  selectStrategyLiveStats,
  selectEquity,
  selectUnrealizedPnl,
  STRATEGIES,
  getCandles,
  getCurrentPrice,
  nextId,
} from "@/lib/store/server-trading-store";
