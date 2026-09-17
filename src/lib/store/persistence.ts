// Persistent memory for the trading engine.
//
// Saves the user's session state (positions, trades, P&L, equity curve,
// pair configs, strategy toggles, backtest cache, settings) to localStorage
// so it survives page reloads. The live market data (prices, candle cache,
// signals) is NOT persisted — it's transient and rebuilds on engine restart.
//
// Saves are debounced (every 3 seconds) to avoid hammering localStorage on
// every tick. Loads happen once on store creation.

import type { TradingState } from "./trading-store";

const STORAGE_KEY = "neonscalp.session.v1";
const SAVE_DEBOUNCE_MS = 3000;

export interface PersistedSession {
  version: 1;
  savedAt: number;
  startingBalance: number;
  realizedPnl: number;
  positions: TradingState["positions"];
  trades: TradingState["trades"];
  equityCurve: TradingState["equityCurve"];
  pairs: TradingState["pairs"];
  settings: TradingState["settings"];
  tickMs: number;
  backtest: {
    byStrategy: TradingState["backtest"]["byStrategy"];
    byPairStrategy: TradingState["backtest"]["byPairStrategy"];
    days: number;
    status: "done" | "idle";
  };
}

export function loadSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (parsed.version !== 1) return null;
    // Sanity checks
    if (
      !Array.isArray(parsed.positions) ||
      !Array.isArray(parsed.trades) ||
      !Array.isArray(parsed.equityCurve) ||
      !Array.isArray(parsed.pairs)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: PersistedSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    // localStorage may be full or disabled — fail silently
    console.warn("[Pulsar] Failed to save session:", err);
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Debounced save — coalesces multiple save requests within SAVE_DEBOUNCE_MS
// into a single write.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSnapshot: (() => PersistedSession) | null = null;

export function debouncedSave(snapshotFn: () => PersistedSession): void {
  pendingSnapshot = snapshotFn;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (pendingSnapshot) {
      const snap = pendingSnapshot;
      pendingSnapshot = null;
      saveSession(snap());
    }
  }, SAVE_DEBOUNCE_MS);
}

// Force an immediate save (used when the user closes the tab)
export function flushSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingSnapshot) {
    const snap = pendingSnapshot;
    pendingSnapshot = null;
    saveSession(snap());
  }
}
