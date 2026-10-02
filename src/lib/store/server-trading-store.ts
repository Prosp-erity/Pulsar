// Client-side store that syncs with server-side trading engine
// This store polls the server for state and provides the same interface
// as the old client-side store, but all data comes from the server

"use client";

import { create } from "zustand";
import { useEffect, useRef } from "react";
import type {
  EngineSettings,
  PairConfig,
  Position,
  Signal,
  StrategyId,
  Trade,
} from "@/lib/trading/types";

// API base URL
const API_BASE = "/api/engine";

// Engine status from server
interface ServerEngineStatus {
  running: boolean;
  startedAt: string | null;
  lastHeartbeat: string | null;
  ticksProcessed: number;
  activePositions: number;
  totalTrades: number;
  uptimeSeconds: number | null;
}

// Full server state
interface ServerEngineState {
  running: boolean;
  startedAt: number | null;
  lastTickAt: number | null;
  ticksProcessed: number;
  lastHeartbeatAt: number | null;
  pairs: PairConfig[];
  settings: EngineSettings;
  positions: Position[];
  trades: Trade[];
  signals: Signal[];
  startingBalance: number;
  realizedPnl: number;
  equityCurve: { t: number; v: number }[];
  prices: Record<string, number>;
  prevPrices: Record<string, number>;
  lossStreaks: Record<StrategyId, number>;
  autoDisabled: Record<StrategyId, boolean>;
}

// Backtest state (kept client-side for now)
interface BacktestState {
  status: "idle" | "running" | "done" | "error";
  suite: any | null;
  byStrategy: Partial<Record<StrategyId, any>>;
  byPairStrategy: Record<string, any>;
  selectedStrategy: StrategyId;
  selectedSymbol: string;
  days: number;
  startedAt: number;
  completedAt: number;
  error: string | null;
}

interface TradingState {
  // Engine state from server
  running: boolean;
  tickMs: number;
  pairs: PairConfig[];
  settings: EngineSettings;
  positions: Position[];
  trades: Trade[];
  signals: Signal[];
  prices: Record<string, number>;
  prevPrices: Record<string, number>;
  startingBalance: number;
  realizedPnl: number;
  equityCurve: { t: number; v: number }[];
  lastTickAt: number;
  candlesCache: Record<string, { time: number; close: number }[]>;
  
  // Navigation
  activeView: "dashboard" | "backtest" | "strategies" | "live" | "risk" | "assistant";
  
  // Backtest (client-side)
  backtest: BacktestState;
  
  // Status from server
  engineStatus: ServerEngineStatus | null;
  lastUpdatedAt: number;
  
  // Actions
  setActiveView: (v: "dashboard" | "backtest" | "strategies" | "live" | "risk" | "assistant") => void;
  runBacktests: () => void;
  selectBacktest: (strategy: StrategyId, symbol: string) => void;
  setBacktestDays: (days: number) => void;
  setStrategyGloballyEnabled: (strategy: StrategyId, enabled: boolean) => void;
  isStrategyGloballyEnabled: (strategy: StrategyId) => boolean;
  
  // Engine actions (now call server)
  toggleEngine: () => void;
  startEngine: () => void;
  stopEngine: () => void;
  resetEngine: () => void;
  setTickMs: (ms: number) => void;
  togglePair: (symbol: string) => void;
  togglePairStrategy: (symbol: string, strategy: StrategyId) => void;
  updateSettings: (patch: Partial<EngineSettings>) => void;
  closePositionManually: (id: string) => void;
  closeAllPositions: () => void;
  tick: () => void; // No-op on client, but kept for compatibility
  pricesSnapshot: () => Record<string, number>;
  _pushEquityPoint: () => void; // No-op on client
  
  // Persistence
  lastSavedAt: number;
  clearHistory: () => void;
  
  // Auto-disable on loss streak
  lossStreaks: Record<StrategyId, number>;
  autoDisabled: Record<StrategyId, boolean>;
  resetLossStreak: (strategy: StrategyId) => void;
}

// Default settings
const DEFAULT_SETTINGS: EngineSettings = {
  leverage: 2,
  riskPerTradePct: 0.5,
  maxPositionsPerPair: 2,
  maxTotalPositions: 12,
  defaultStopPct: 0.008,
  defaultTargetPct: 0.012,
  tickMs: 1500,
};

const DEFAULT_PAIRS: PairConfig[] = [
  {
    symbol: "BTC/USDT",
    basePrice: 64250,
    volatility: 0.62,
    drift: 0.18,
    enabled: true,
    strategies: {
      connors_rsi: true,
      vwap_fade_pro: true,
      liquidity_sweep: true,
      session_orb: true,
      bb_squeeze_mtf: true,
    },
  },
  {
    symbol: "ETH/USDT",
    basePrice: 3142,
    volatility: 0.78,
    drift: 0.22,
    enabled: true,
    strategies: {
      connors_rsi: true,
      vwap_fade_pro: true,
      liquidity_sweep: true,
      session_orb: true,
      bb_squeeze_mtf: true,
    },
  },
  {
    symbol: "SOL/USDT",
    basePrice: 142.7,
    volatility: 1.05,
    drift: 0.28,
    enabled: true,
    strategies: {
      connors_rsi: true,
      vwap_fade_pro: true,
      liquidity_sweep: true,
      session_orb: true,
      bb_squeeze_mtf: true,
    },
  },
  {
    symbol: "AVAX/USDT",
    basePrice: 27.4,
    volatility: 1.18,
    drift: 0.15,
    enabled: true,
    strategies: {
      connors_rsi: true,
      vwap_fade_pro: true,
      liquidity_sweep: true,
      session_orb: true,
      bb_squeeze_mtf: true,
    },
  },
  {
    symbol: "DOGE/USDT",
    basePrice: 0.1245,
    volatility: 1.42,
    drift: 0.1,
    enabled: true,
    strategies: {
      connors_rsi: true,
      vwap_fade_pro: true,
      liquidity_sweep: true,
      session_orb: true,
      bb_squeeze_mtf: true,
    },
  },
  {
    symbol: "ARB/USDT",
    basePrice: 0.872,
    volatility: 1.32,
    drift: 0.12,
    enabled: true,
    strategies: {
      connors_rsi: true,
      vwap_fade_pro: true,
      liquidity_sweep: true,
      session_orb: true,
      bb_squeeze_mtf: true,
    },
  },
];

const STARTING_BALANCE = 25000;

// Fetch engine status from server
export async function fetchEngineStatus(): Promise<ServerEngineStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/status`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Fetch full engine state from server
export async function fetchEngineState(): Promise<ServerEngineState | null> {
  try {
    const res = await fetch(`${API_BASE}/state`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Call engine control API
export async function callEngineControl(action: string, payload?: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/control`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, ...payload }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

// Polling interval
const POLL_INTERVAL_MS = 1500; // Match tick interval

// Create the store
export const useTradingStore = create<TradingState>((set, get) => ({
  // Initial state - will be replaced by server state
  running: false,
  tickMs: DEFAULT_SETTINGS.tickMs,
  pairs: [...DEFAULT_PAIRS],
  settings: { ...DEFAULT_SETTINGS },
  positions: [],
  trades: [],
  signals: [],
  prices: Object.fromEntries(DEFAULT_PAIRS.map((p) => [p.symbol, p.basePrice])),
  prevPrices: Object.fromEntries(DEFAULT_PAIRS.map((p) => [p.symbol, p.basePrice])),
  startingBalance: STARTING_BALANCE,
  realizedPnl: 0,
  equityCurve: [{ t: Date.now(), v: STARTING_BALANCE }],
  lastTickAt: Date.now(),
  candlesCache: {},
  activeView: "dashboard",
  backtest: {
    status: "idle",
    suite: null,
    byStrategy: {},
    byPairStrategy: {},
    selectedStrategy: "connors_rsi",
    selectedSymbol: "BTC/USDT",
    days: 90,
    startedAt: 0,
    completedAt: 0,
    error: null,
  },
  engineStatus: null,
  lastUpdatedAt: 0,
  lastSavedAt: 0,
  lossStreaks: {
    connors_rsi: 0,
    vwap_fade_pro: 0,
    liquidity_sweep: 0,
    session_orb: 0,
    bb_squeeze_mtf: 0,
  },
  autoDisabled: {
    connors_rsi: false,
    vwap_fade_pro: false,
    liquidity_sweep: false,
    session_orb: false,
    bb_squeeze_mtf: false,
  },

  setActiveView: (v) => set({ activeView: v }),

  runBacktests: () => {
    const state = get();
    if (state.backtest.status === "running") return;
    
    set({
      backtest: {
        ...state.backtest,
        status: "running",
        startedAt: Date.now(),
        error: null,
      },
    });
    
    // Import and run backtests (client-side logic kept for now)
    import("@/lib/trading/backtest").then(({ runBacktestSuite }) => {
      const { STRATEGIES } = require("@/lib/trading/strategies");
      const pairs = get().pairs;
      const days = get().backtest.days;
      
      try {
        const suite = runBacktestSuite(pairs, {
          days,
          candleMs: 5 * 60_000,
          initialCapital: 10_000,
        });
        const byStrategy: Partial<Record<StrategyId, any>> = {};
        const byPairStrategy: Record<string, any> = {};
        
        for (const id of Object.keys(STRATEGIES) as StrategyId[]) {
          const candidates = suite.results.filter((r: any) => r.strategyId === id);
          candidates.sort((a: any, b: any) => b.stats.profitFactor - a.stats.profitFactor);
          if (candidates[0]) byStrategy[id] = candidates[0];
        }
        for (const r of suite.results) {
          byPairStrategy[`${r.strategyId}|${r.symbol}`] = r;
        }
        
        const cur = get();
        set({
          backtest: {
            ...cur.backtest,
            status: "done",
            suite,
            byStrategy,
            byPairStrategy,
            completedAt: Date.now(),
          },
        });
      } catch (err) {
        const cur = get();
        set({
          backtest: {
            ...cur.backtest,
            status: "error",
            error: err instanceof Error ? err.message : String(err),
            completedAt: Date.now(),
          },
        });
      }
    });
  },

  selectBacktest: (strategy, symbol) => {
    set((s) => ({
      backtest: {
        ...s.backtest,
        selectedStrategy: strategy,
        selectedSymbol: symbol,
      },
    }));
  },

  setBacktestDays: (days) => {
    set((s) => ({ backtest: { ...s.backtest, days } }));
  },

  setStrategyGloballyEnabled: (strategy, enabled) => {
    // This now needs to call the server
    callEngineControl("updateSettings", {
      patch: { [strategy]: enabled }
    });
    
    // Optimistic update
    set((s) => ({
      pairs: s.pairs.map((p) => ({
        ...p,
        strategies: {
          ...p.strategies,
          [strategy]: enabled,
        },
      })),
    }));
  },

  isStrategyGloballyEnabled: (strategy) => {
    const pairs = get().pairs;
    return pairs.some((p) => p.strategies[strategy]);
  },

  toggleEngine: () => {
    const r = get().running;
    if (r) {
      callEngineControl("stop");
    } else {
      callEngineControl("start");
    }
    set({ running: !r });
  },

  startEngine: () => {
    callEngineControl("start");
    set({ running: true });
  },

  stopEngine: () => {
    callEngineControl("stop");
    set({ running: false });
  },

  resetEngine: () => {
    callEngineControl("reset");
    set({
      running: false,
      positions: [],
      trades: [],
      signals: [],
      realizedPnl: 0,
      equityCurve: [{ t: Date.now(), v: STARTING_BALANCE }],
      prices: Object.fromEntries(get().pairs.map((p) => [p.symbol, p.basePrice])),
      prevPrices: Object.fromEntries(get().pairs.map((p) => [p.symbol, p.basePrice])),
      candlesCache: {},
    });
  },

  setTickMs: (ms) => {
    callEngineControl("updateSettings", {
      patch: { tickMs: ms }
    });
    set({ tickMs: ms });
  },

  togglePair: (symbol) => {
    callEngineControl("togglePair", { symbol });
    
    // Optimistic update
    set((s) => ({
      pairs: s.pairs.map((p) =>
        p.symbol === symbol ? { ...p, enabled: !p.enabled } : p,
      ),
    }));
  },

  togglePairStrategy: (symbol, strategy) => {
    callEngineControl("togglePairStrategy", { symbol, strategy });
    
    // Optimistic update
    set((s) => ({
      pairs: s.pairs.map((p) =>
        p.symbol === symbol
          ? {
              ...p,
              strategies: {
                ...p.strategies,
                [strategy]: !p.strategies[strategy],
              },
            }
          : p,
      ),
    }));
  },

  updateSettings: (patch) => {
    callEngineControl("updateSettings", { patch });
    set((s) => ({ settings: { ...s.settings, ...patch } }));
  },

  closePositionManually: (id) => {
    callEngineControl("closePosition", { id });
    
    const state = get();
    const pos = state.positions.find((p) => p.id === id);
    if (!pos) return;
    
    const exitPrice = state.prices[pos.pair] ?? pos.entryPrice;
    const dir = pos.side === "LONG" ? 1 : -1;
    const pnl = (exitPrice - pos.entryPrice) * pos.size * dir;
    const outcome = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN";
    
    // Optimistic update
    set((s) => ({
      positions: s.positions.filter((p) => p.id !== id),
      realizedPnl: s.realizedPnl + pnl,
    }));
    get()._pushEquityPoint();
  },

  closeAllPositions: () => {
    callEngineControl("closeAllPositions");
    
    const state = get();
    if (state.positions.length === 0) return;
    
    let totalPnl = 0;
    for (const pos of state.positions) {
      const exitPrice = state.prices[pos.pair] ?? pos.entryPrice;
      const dir = pos.side === "LONG" ? 1 : -1;
      const pnl = (exitPrice - pos.entryPrice) * pos.size * dir;
      totalPnl += pnl;
    }
    
    // Optimistic update
    set((s) => ({
      positions: [],
      realizedPnl: s.realizedPnl + totalPnl,
    }));
    get()._pushEquityPoint();
  },

  tick: () => {
    // No-op - ticks are handled server-side
    // But we can fetch latest state
    fetchEngineState().then((serverState) => {
      if (serverState) {
        set({
          positions: serverState.positions,
          trades: serverState.trades,
          signals: serverState.signals,
          prices: serverState.prices,
          prevPrices: serverState.prevPrices,
          realizedPnl: serverState.realizedPnl,
          equityCurve: serverState.equityCurve,
          lastTickAt: serverState.lastTickAt || Date.now(),
          running: serverState.running,
        });
      }
    });
  },

  pricesSnapshot: () => get().prices,

  _pushEquityPoint: () => {
    const s = get();
    const unreal = s.positions.reduce((acc, p) => {
      const px = s.prices[p.pair] ?? p.entryPrice;
      const dir = p.side === "LONG" ? 1 : -1;
      return acc + (px - p.entryPrice) * p.size * dir;
    }, 0);
    const equity = s.startingBalance + s.realizedPnl + unreal;
    const last = s.equityCurve[s.equityCurve.length - 1];
    if (last && Date.now() - last.t < 1500) {
      set((st) => ({
        equityCurve: [
          ...st.equityCurve.slice(0, -1),
          { t: Date.now(), v: equity },
        ].slice(-180),
      }));
    } else {
      set((st) => ({
        equityCurve: [...st.equityCurve, { t: Date.now(), v: equity }].slice(-180),
      }));
    }
  },

  resetLossStreak: (strategy) => {
    callEngineControl("resetLossStreak", { strategy });
    
    set((s) => ({
      lossStreaks: { ...s.lossStreaks, [strategy]: 0 },
      autoDisabled: { ...s.autoDisabled, [strategy]: false },
      pairs: s.pairs.map((p) => ({
        ...p,
        strategies: {
          ...p.strategies,
          [strategy]: true,
        },
      })),
    }));
  },

  clearHistory: () => {
    callEngineControl("clearHistory");
    set({
      running: false,
      positions: [],
      trades: [],
      signals: [],
      realizedPnl: 0,
      equityCurve: [{ t: Date.now(), v: STARTING_BALANCE }],
      prices: Object.fromEntries(get().pairs.map((p) => [p.symbol, p.basePrice])),
      prevPrices: Object.fromEntries(get().pairs.map((p) => [p.symbol, p.basePrice])),
      candlesCache: {},
      lastSavedAt: 0,
      startingBalance: STARTING_BALANCE,
    });
  },
}));

// Polling hook - use this in your components to keep state in sync
export function useEngineStateSync() {
  const store = useTradingStore();
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<ServerEngineStatus | null>(null);

  // Initial fetch and polling
  useEffect(() => {
    const fetchState = async () => {
      try {
        const serverState = await fetchEngineState();
        const status = await fetchEngineStatus();
        
        if (serverState) {
          // Update store with server state
          useTradingStore.setState({
            running: serverState.running,
            tickMs: serverState.settings?.tickMs || store.tickMs,
            pairs: serverState.pairs || store.pairs,
            settings: serverState.settings || store.settings,
            positions: serverState.positions || store.positions,
            trades: serverState.trades || store.trades,
            signals: serverState.signals || store.signals,
            prices: serverState.prices || store.prices,
            prevPrices: serverState.prevPrices || store.prevPrices,
            startingBalance: serverState.startingBalance || store.startingBalance,
            realizedPnl: serverState.realizedPnl || store.realizedPnl,
            equityCurve: serverState.equityCurve || store.equityCurve,
            lastTickAt: serverState.lastTickAt || store.lastTickAt,
            lossStreaks: serverState.lossStreaks || store.lossStreaks,
            autoDisabled: serverState.autoDisabled || store.autoDisabled,
            engineStatus: status,
            lastUpdatedAt: Date.now(),
          });
        }
        
        if (status) {
          useTradingStore.setState({
            engineStatus: status,
            lastUpdatedAt: Date.now(),
          });
        }
        
        lastStatusRef.current = status;
      } catch (err) {
        console.error("Failed to fetch engine state:", err);
      }
    };

    // Initial fetch
    fetchState();

    // Set up polling
    pollRef.current = setInterval(fetchState, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [store]);

  return null;
}

// Selector helpers (same as before)
export function selectStrategyLiveStats(
  trades: Trade[],
  positions: Position[],
): Record<StrategyId, { pnl: number; trades: number; wins: number }> {
  const out: Record<string, { pnl: number; trades: number; wins: number }> = {
    connors_rsi: { pnl: 0, trades: 0, wins: 0 },
    vwap_fade_pro: { pnl: 0, trades: 0, wins: 0 },
    liquidity_sweep: { pnl: 0, trades: 0, wins: 0 },
    session_orb: { pnl: 0, trades: 0, wins: 0 },
    bb_squeeze_mtf: { pnl: 0, trades: 0, wins: 0 },
  };
  for (const t of trades) {
    out[t.strategy].pnl += t.pnl;
    out[t.strategy].trades += 1;
    if (t.outcome === "WIN") out[t.strategy].wins += 1;
  }
  for (const p of positions) {
    out[p.strategy].pnl += p.unrealizedPnl;
  }
  return out as Record<StrategyId, { pnl: number; trades: number; wins: number }>;
}

export function selectEquity(state: TradingState): number {
  const unreal = state.positions.reduce((acc, p) => {
    const px = state.prices[p.pair] ?? p.entryPrice;
    const dir = p.side === "LONG" ? 1 : -1;
    return acc + (px - p.entryPrice) * p.size * dir;
  }, 0);
  return state.startingBalance + state.realizedPnl + unreal;
}

export function selectUnrealizedPnl(state: TradingState): number {
  return state.positions.reduce((acc, p) => {
    const px = state.prices[p.pair] ?? p.entryPrice;
    const dir = p.side === "LONG" ? 1 : -1;
    return acc + (px - p.entryPrice) * p.size * dir;
  }, 0);
}

// Re-export types and constants
export { DEFAULT_PAIRS, DEFAULT_SETTINGS, STARTING_BALANCE };
