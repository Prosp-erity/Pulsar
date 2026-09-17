"use client";

import { create } from "zustand";
import {
  DEFAULT_PAIRS,
  DEFAULT_SETTINGS,
  buildPositionFromSignal,
  evaluateSignalsForPair,
  nextId,
  positionToTrade,
  updatePosition,
} from "@/lib/trading/engine";
import { tickPair, getCandles, getCurrentPrice } from "@/lib/trading/market";
import { STRATEGIES } from "@/lib/trading/strategies";
import {
  runBacktest,
  runBacktestSuite,
  type BacktestResult,
  type BacktestSuiteResult,
} from "@/lib/trading/backtest";
import type {
  EngineSettings,
  PairConfig,
  Position,
  Signal,
  StrategyId,
  Trade,
} from "@/lib/trading/types";
import {
  loadSession,
  debouncedSave,
  flushSave,
  clearSession,
  type PersistedSession,
} from "./persistence";
import { getTickWorker, destroyTickWorker } from "@/lib/trading/worker-manager";

const STARTING_BALANCE = 25000;

// ---------------- Load persisted session (if any) ----------------
const persisted = typeof window !== "undefined" ? loadSession() : null;

interface BacktestState {
  status: "idle" | "running" | "done" | "error";
  suite: BacktestSuiteResult | null;
  byStrategy: Partial<Record<StrategyId, BacktestResult>>;
  byPairStrategy: Record<string, BacktestResult>;
  selectedStrategy: StrategyId;
  selectedSymbol: string;
  days: number;
  startedAt: number;
  completedAt: number;
  error: string | null;
}

interface TradingState {
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
  // navigation
  activeView: "dashboard" | "backtest" | "strategies" | "live" | "risk" | "assistant";
  // backtest
  backtest: BacktestState;
  // actions
  setActiveView: (v: "dashboard" | "backtest" | "strategies" | "live" | "risk" | "assistant") => void;
  runBacktests: () => void;
  selectBacktest: (strategy: StrategyId, symbol: string) => void;
  setBacktestDays: (days: number) => void;
  setStrategyGloballyEnabled: (strategy: StrategyId, enabled: boolean) => void;
  isStrategyGloballyEnabled: (strategy: StrategyId) => boolean;
  // engine actions
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
  tick: () => void;
  pricesSnapshot: () => Record<string, number>;
  _pushEquityPoint: () => void;
  // persistence
  lastSavedAt: number;
  clearHistory: () => void;
  // auto-disable on loss streak
  lossStreaks: Record<StrategyId, number>;
  autoDisabled: Record<StrategyId, boolean>;
  resetLossStreak: (strategy: StrategyId) => void;
}

let timer: ReturnType<typeof setInterval> | null = null;
let worker: Worker | null = null;

function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export const useTradingStore = create<TradingState>((set, get) => ({
  running: false,
  tickMs: persisted?.tickMs ?? DEFAULT_SETTINGS.tickMs,
  pairs: persisted?.pairs ?? DEFAULT_PAIRS.map((p) => ({ ...p })),
  settings: persisted?.settings ?? DEFAULT_SETTINGS,
  positions: persisted?.positions ?? [],
  trades: persisted?.trades ?? [],
  signals: [],
  prices: Object.fromEntries(DEFAULT_PAIRS.map((p) => [p.symbol, p.basePrice])),
  prevPrices: Object.fromEntries(DEFAULT_PAIRS.map((p) => [p.symbol, p.basePrice])),
  startingBalance: persisted?.startingBalance ?? STARTING_BALANCE,
  realizedPnl: persisted?.realizedPnl ?? 0,
  equityCurve: persisted?.equityCurve ?? [{ t: Date.now(), v: STARTING_BALANCE }],
  lastTickAt: Date.now(),
  candlesCache: {},
  activeView: "dashboard",
  backtest: {
    status: persisted?.backtest?.status === "done" ? "done" : "idle",
    suite: null,
    byStrategy: persisted?.backtest?.byStrategy ?? {},
    byPairStrategy: persisted?.backtest?.byPairStrategy ?? {},
    selectedStrategy: "connors_rsi",
    selectedSymbol: "BTC/USDT",
    days: persisted?.backtest?.days ?? 90,
    startedAt: 0,
    completedAt: 0,
    error: null,
  },
  lastSavedAt: persisted?.savedAt ?? 0,
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
    const pairs = state.pairs;
    const days = state.backtest.days;
    set({
      backtest: {
        ...state.backtest,
        status: "running",
        startedAt: Date.now(),
        error: null,
      },
    });
    // Run in a microtask so the UI can update first
    setTimeout(() => {
      try {
        const suite = runBacktestSuite(pairs, {
          days,
          candleMs: 5 * 60_000,
          initialCapital: 10_000,
        });
        const byStrategy: Partial<Record<StrategyId, BacktestResult>> = {};
        const byPairStrategy: Record<string, BacktestResult> = {};
        // Pick one representative result per strategy (best profit factor)
        for (const id of Object.keys(STRATEGIES) as StrategyId[]) {
          const candidates = suite.results.filter((r) => r.strategyId === id);
          candidates.sort((a, b) => b.stats.profitFactor - a.stats.profitFactor);
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
        _persist();
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
    }, 50);
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
    set((s) => ({
      pairs: s.pairs.map((p) => ({
        ...p,
        strategies: {
          ...p.strategies,
          [strategy]: enabled,
        },
      })),
    }));
    _persist();
  },

  isStrategyGloballyEnabled: (strategy) => {
    const pairs = get().pairs;
    // Strategy is "globally enabled" if it's enabled on at least one pair
    return pairs.some((p) => p.strategies[strategy]);
  },


  toggleEngine: () => {
    const r = get().running;
    if (r) get().stopEngine();
    else get().startEngine();
  },

  startEngine: () => {
    if (timer || worker) return;
    set({ running: true });
    
    // Try to use a Web Worker for the tick loop — workers are NOT
    // throttled by the browser when the tab is in the background, so
    // the engine keeps running at full speed even when the user
    // switches to another tab or the screen times out.
    const tickWorker = getTickWorker();
    if (tickWorker) {
      tickWorker.onmessage = () => {
        try {
          get().tick();
        } catch (err) {
          console.error("tick error", err);
        }
      };
      tickWorker.postMessage({ type: "start", ms: get().tickMs });
      worker = tickWorker;
    } else {
      // Fallback to setInterval if workers aren't available
      timer = setInterval(() => {
        try {
          get().tick();
        } catch (err) {
          console.error("tick error", err);
        }
      }, get().tickMs);
    }
    // fire one immediate tick so the UI fills fast
    get().tick();
  },

  stopEngine: () => {
    if (worker) {
      worker.postMessage({ type: "stop" });
      worker = null;
    }
    clearTimer();
    set({ running: false });
  },

  resetEngine: () => {
    if (worker) {
      worker.postMessage({ type: "stop" });
      worker = null;
    }
    clearTimer();
    // close all open positions at current price (no realized pnl booking)
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
    _persist();
  },

  setTickMs: (ms) => {
    set({ tickMs: ms });
    if (worker) {
      worker.postMessage({ type: "setInterval", ms });
    } else if (get().running) {
      clearTimer();
      timer = setInterval(() => get().tick(), ms);
    }
    _persist();
  },

  togglePair: (symbol) => {
    set((s) => ({
      pairs: s.pairs.map((p) =>
        p.symbol === symbol ? { ...p, enabled: !p.enabled } : p,
      ),
    }));
    _persist();
  },

  togglePairStrategy: (symbol, strategy) => {
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
    _persist();
  },

  updateSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
    _persist();
  },

  closePositionManually: (id) => {
    const { positions, prices } = get();
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;
    const exitPrice = prices[pos.pair] ?? pos.entryPrice;
    const dir = pos.side === "LONG" ? 1 : -1;
    const pnl = (exitPrice - pos.entryPrice) * pos.size * dir;
    const outcome = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN";
    const trade = positionToTrade(pos, exitPrice, "Manual close", outcome);
    set((s) => ({
      positions: s.positions.filter((p) => p.id !== id),
      trades: [trade, ...s.trades].slice(0, 200),
      realizedPnl: s.realizedPnl + pnl,
    }));
    get()._pushEquityPoint();
  },

  closeAllPositions: () => {
    const { positions, prices } = get();
    if (positions.length === 0) return;
    let totalPnl = 0;
    const newTrades: Trade[] = [];
    for (const pos of positions) {
      const exitPrice = prices[pos.pair] ?? pos.entryPrice;
      const dir = pos.side === "LONG" ? 1 : -1;
      const pnl = (exitPrice - pos.entryPrice) * pos.size * dir;
      const outcome = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN";
      newTrades.push(positionToTrade(pos, exitPrice, "Closed all", outcome));
      totalPnl += pnl;
    }
    set((s) => ({
      positions: [],
      trades: [...newTrades.reverse(), ...s.trades].slice(0, 200),
      realizedPnl: s.realizedPnl + totalPnl,
    }));
    get()._pushEquityPoint();
  },

  tick: () => {
    const state = get();
    const newPrices: Record<string, number> = { ...state.prices };
    const prevPrices: Record<string, number> = { ...state.prevPrices };
    const newCandlesCache: Record<string, { time: number; close: number }[]> = {
      ...state.candlesCache,
    };

    // Track which pairs got a NEW candle this tick (for signal evaluation)
    const pairsWithNewCandle: string[] = [];

    // 1. Advance market for every enabled pair
    for (const pair of state.pairs) {
      if (!pair.enabled) continue;
      const { price, candle } = tickPair(pair);
      prevPrices[pair.symbol] = newPrices[pair.symbol] ?? price;
      newPrices[pair.symbol] = price;
      // Detect if a new candle was completed this tick (candle is only
      // returned when a new candle is added to the history)
      if (candle) {
        pairsWithNewCandle.push(pair.symbol);
      }
      // Create a NEW array each tick so useSyncExternalStore detects the change
      const prevArr = newCandlesCache[pair.symbol] ?? [];
      const arr = prevArr.length >= 120 ? prevArr.slice(1) : [...prevArr];
      arr.push({ time: candle?.time ?? Date.now(), close: price });
      newCandlesCache[pair.symbol] = arr;
    }

    // 2. Update open positions, close if stops/targets hit
    const stillOpen: Position[] = [];
    const closedTrades: Trade[] = [];
    let realizedDelta = 0;
    // Track loss streaks per strategy
    const streakDelta: Record<string, number> = {};
    const strategiesToDisable: StrategyId[] = [];
    for (const pos of state.positions) {
      const px = newPrices[pos.pair] ?? pos.entryPrice;
      const upd = updatePosition({ position: pos, price: px, settings: state.settings });
      if (upd.shouldClose) {
        closedTrades.push(
          positionToTrade(pos, px, upd.closeReason, upd.outcome),
        );
        realizedDelta += upd.pnl;
        // Update loss streak
        if (upd.outcome === "LOSS") {
          streakDelta[pos.strategy] = (streakDelta[pos.strategy] ?? 0) + 1;
        } else if (upd.outcome === "WIN") {
          streakDelta[pos.strategy] = (streakDelta[pos.strategy] ?? 0) - 100; // reset on win
        }
      } else {
        stillOpen.push(upd.position);
      }
    }

    // Check for 7-loss streak auto-disable
    const newLossStreaks = { ...state.lossStreaks };
    const newAutoDisabled = { ...state.autoDisabled };
    for (const [strat, delta] of Object.entries(streakDelta)) {
      const strategy = strat as StrategyId;
      if (delta > 0) {
        newLossStreaks[strategy] = (newLossStreaks[strategy] ?? 0) + delta;
        if (newLossStreaks[strategy] >= 7 && !newAutoDisabled[strategy]) {
          newAutoDisabled[strategy] = true;
          strategiesToDisable.push(strategy);
        }
      } else if (delta < 0) {
        newLossStreaks[strategy] = 0; // reset on win
      }
    }

    // 3. Look for new signals & open positions — ONLY on new candle closes
    // (matches backtest behavior: strategies evaluate on candle close, not
    // every tick. This is the key fix that aligns live WR with backtested WR.)
    const allNewSignals: Signal[] = [];
    const openCountByPair: Record<string, number> = {};
    for (const p of stillOpen) {
      openCountByPair[p.pair] = (openCountByPair[p.pair] ?? 0) + 1;
    }
    const equity = state.startingBalance + state.realizedPnl + realizedDelta;
    for (const pair of state.pairs) {
      if (!pair.enabled) continue;
      // Only evaluate signals when a new candle just completed
      if (!pairsWithNewCandle.includes(pair.symbol)) continue;
      const sigs = evaluateSignalsForPair(pair);
      for (const sig of sigs) {
        allNewSignals.push(sig);
        // If we already have an open position from this strategy on this pair, skip
        const dup = stillOpen.some(
          (p) => p.pair === sig.pair && p.strategy === sig.strategy,
        );
        if (dup) continue;
        const pos = buildPositionFromSignal({
          pair,
          signal: sig,
          price: newPrices[pair.symbol] ?? pair.basePrice,
          equity,
          settings: state.settings,
          openCountForPair: openCountByPair[pair.symbol] ?? 0,
          totalOpen: stillOpen.length,
        });
        if (pos) {
          stillOpen.push(pos);
          openCountByPair[pair.symbol] = (openCountByPair[pair.symbol] ?? 0) + 1;
        }
      }
    }

    // 4. Compute totals & equity curve
    const realizedPnl = state.realizedPnl + realizedDelta;
    const trades = [...closedTrades.reverse(), ...state.trades].slice(0, 200);
    const signals = [...allNewSignals.reverse(), ...state.signals].slice(0, 80);

    // DAILY LOSS LIMIT: If the account has lost more than 20% of starting
    // balance, halt the engine immediately. This is the circuit breaker
    // that prevents the death-spiral wipeouts.
    const currentEquity = state.startingBalance + realizedPnl;
    const lossPct = (currentEquity - state.startingBalance) / state.startingBalance;
    if (lossPct < -0.20 && state.running) {
      // Halt engine — 20% daily loss limit hit
      if (worker) {
        worker.postMessage({ type: "stop" });
        worker = null;
      }
      clearTimer();
      set({
        positions: stillOpen,
        trades,
        signals,
        prices: newPrices,
        prevPrices,
        realizedPnl,
        lastTickAt: Date.now(),
        candlesCache: newCandlesCache,
        lossStreaks: newLossStreaks,
        autoDisabled: newAutoDisabled,
        pairs: finalPairs,
        running: false,
      });
      get()._pushEquityPoint();
      return;
    }

    // Apply 7-loss-streak auto-disable: disable the strategy on all pairs
    let finalPairs = state.pairs;
    if (strategiesToDisable.length > 0) {
      finalPairs = state.pairs.map((p) => ({
        ...p,
        strategies: {
          ...p.strategies,
          ...Object.fromEntries(strategiesToDisable.map((s) => [s, false])),
        },
      }));
    }

    set({
      positions: stillOpen,
      trades,
      signals,
      prices: newPrices,
      prevPrices,
      realizedPnl,
      lastTickAt: Date.now(),
      candlesCache: newCandlesCache,
      lossStreaks: newLossStreaks,
      autoDisabled: newAutoDisabled,
      pairs: finalPairs,
    });

    get()._pushEquityPoint();
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
      // replace last
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
    // Trigger debounced save (3s coalesce)
    _persist();
  },

  resetLossStreak: (strategy) => {
    set((s) => ({
      lossStreaks: { ...s.lossStreaks, [strategy]: 0 },
      autoDisabled: { ...s.autoDisabled, [strategy]: false },
      // Re-enable the strategy on all pairs that had it before
      pairs: s.pairs.map((p) => ({
        ...p,
        strategies: {
          ...p.strategies,
          [strategy]: true, // re-enable globally
        },
      })),
    }));
    _persist();
  },

  clearHistory: () => {
    clearSession();
    clearTimer();
    set({
      running: false,
      positions: [],
      trades: [],
      signals: [],
      realizedPnl: 0,
      equityCurve: [{ t: Date.now(), v: STARTING_BALANCE }],
      prices: Object.fromEntries(DEFAULT_PAIRS.map((p) => [p.symbol, p.basePrice])),
      prevPrices: Object.fromEntries(DEFAULT_PAIRS.map((p) => [p.symbol, p.basePrice])),
      candlesCache: {},
      lastSavedAt: 0,
      startingBalance: STARTING_BALANCE,
    });
  },
}));

// ---------------- Persistence helper ----------------
function _persist() {
  debouncedSave(() => {
    const s = useTradingStore.getState();
    // Trim backtest results to stay under localStorage quota (5MB).
    // We only need the stats + monthlyReturns + a sampled equity curve —
    // not the full 25,000-point curve or 2,000-trade list.
    const trimmedByStrategy: PersistedSession["backtest"]["byStrategy"] = {};
    for (const [k, v] of Object.entries(s.backtest.byStrategy)) {
      trimmedByStrategy[k as StrategyId] = trimBacktestResult(v);
    }
    const trimmedByPair: PersistedSession["backtest"]["byPairStrategy"] = {};
    for (const [k, v] of Object.entries(s.backtest.byPairStrategy)) {
      trimmedByPair[k] = trimBacktestResult(v);
    }
    const snapshot: PersistedSession = {
      version: 1,
      savedAt: Date.now(),
      startingBalance: s.startingBalance,
      realizedPnl: s.realizedPnl,
      positions: s.positions,
      // Cap trades at 100 to avoid unbounded localStorage growth
      trades: s.trades.slice(0, 100),
      // Sample equity curve to ~120 points max
      equityCurve: sampleEquityCurve(s.equityCurve, 120),
      pairs: s.pairs,
      settings: s.settings,
      tickMs: s.tickMs,
      backtest: {
        byStrategy: trimmedByStrategy,
        byPairStrategy: trimmedByPair,
        days: s.backtest.days,
        status: s.backtest.status === "done" ? "done" : "idle",
      },
    };
    // Update lastSavedAt in the store so the UI can show "saved Xs ago"
    useTradingStore.setState({ lastSavedAt: snapshot.savedAt });
    return snapshot;
  });
}

// Trim a BacktestResult to just the essentials (drops big arrays we don't
// need to persist across reloads — they can be recomputed via Re-run).
function trimBacktestResult(r: BacktestResult): BacktestResult {
  return {
    ...r,
    // Keep only stats + monthlyReturns + a heavily sampled equity curve.
    // Drop the full trades list and the drawdown curve (recomputable).
    trades: [],
    equityCurve: sampleEquityCurve(r.equityCurve, 80),
    drawdownCurve: [],
  };
}

// Sample an equity curve down to N points (keeps first + last + evenly spaced)
function sampleEquityCurve(
  curve: { t: number; v: number }[],
  maxPoints: number,
): { t: number; v: number }[] {
  if (curve.length <= maxPoints) return curve;
  const step = Math.ceil(curve.length / maxPoints);
  const out: { t: number; v: number }[] = [];
  for (let i = 0; i < curve.length; i += step) {
    out.push(curve[i]);
  }
  // Always include the last point
  if (out[out.length - 1] !== curve[curve.length - 1]) {
    out.push(curve[curve.length - 1]);
  }
  return out;
}

// Flush save on page hide / beforeunload (so we don't lose the last 3s of state)
if (typeof window !== "undefined") {
  const handler = () => flushSave();
  window.addEventListener("beforeunload", handler);
  window.addEventListener("pagehide", handler);
  // Also save when tab goes to background
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSave();
  });
}

// Selector helpers
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

export { STRATEGIES, getCandles, getCurrentPrice, nextId };
