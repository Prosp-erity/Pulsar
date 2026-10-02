// Server-side trading engine
// This is the authoritative trading engine that runs on the server
// It maintains state, processes ticks, and manages the trading lifecycle

import {
  DEFAULT_PAIRS,
  DEFAULT_SETTINGS,
  buildPositionFromSignal,
  evaluateSignalsForPair,
  nextId,
  positionToTrade,
  updatePosition,
  STRATEGY_PARAMS,
} from "@/lib/trading/engine";
import { tickPair, getCandles, getCurrentPrice } from "@/lib/trading/market";
import { STRATEGIES } from "@/lib/trading/strategies";
import type {
  EngineSettings,
  PairConfig,
  Position,
  Signal,
  StrategyId,
  Trade,
  Candle,
} from "@/lib/trading/types";

import {
  getEngineState,
  setEngineState,
  updateRuntimeState,
  incrementTicks,
  updateHeartbeat,
  startEngineRuntime,
  stopEngineRuntime,
  isEngineRunning,
  getEngineStatus,
  stateLock,
  type EngineStatus,
  type PersistedEngineState,
} from "./trading-engine-state";

import {
  loadEngineState,
  saveEngineState,
  initPersistence,
} from "./trading-engine-persistence";

// Singleton engine instance flag
let engineInitialized = false;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const STARTING_BALANCE = 25000;

// Initialize the engine (call once at server startup)
export async function initializeEngine(): Promise<void> {
  if (engineInitialized) {
    console.log("[PULSAR ENGINE] Engine already initialized");
    return;
  }

  console.log("[PULSAR ENGINE] Starting server-side trading engine...");

  // Initialize persistence
  await initPersistence();

  // Load persisted state
  const persistedState = await loadEngineState();
  
  if (persistedState) {
    console.log("[PULSAR ENGINE] Loaded persisted state");
    setEngineState(persistedState);
  } else {
    console.log("[PULSAR ENGINE] No persisted state found, using defaults");
    // Initialize with default pairs
    const state = getEngineState();
    state.pairs = DEFAULT_PAIRS.map((p) => ({ ...p }));
    state.settings = { ...DEFAULT_SETTINGS };
    state.startingBalance = STARTING_BALANCE;
    state.equityCurve = [{ t: Date.now(), v: STARTING_BALANCE }];
    state.prices = Object.fromEntries(
      DEFAULT_PAIRS.map((p) => [p.symbol, p.basePrice])
    );
    state.prevPrices = Object.fromEntries(
      DEFAULT_PAIRS.map((p) => [p.symbol, p.basePrice])
    );
    setEngineState(state);
  }

  // Start the engine
  await startEngine();

  engineInitialized = true;
  console.log("[PULSAR ENGINE] Started successfully");
}

// Start the trading engine
export async function startEngine(): Promise<void> {
  if (isEngineRunning()) {
    console.log("[PULSAR ENGINE] Engine already running");
    return;
  }

  console.log("[PULSAR ENGINE] Starting engine...");
  startEngineRuntime();

  // Initialize prices for all pairs
  const state = getEngineState();
  const pairs = state.pairs.filter((p) => p.enabled);
  
  if (pairs.length === 0) {
    console.log("[PULSAR ENGINE] No enabled pairs, engine started but idle");
  }

  // Start the tick timer
  const tickMs = state.settings.tickMs || DEFAULT_SETTINGS.tickMs;
  tickTimer = setInterval(() => {
    try {
      processTick();
    } catch (err) {
      console.error("[PULSAR ENGINE] Tick error:", err);
    }
  }, tickMs);

  // Start heartbeat timer (every 30 seconds)
  heartbeatTimer = setInterval(() => {
    updateHeartbeat();
    const status = getEngineStatus();
    console.log(
      `[PULSAR ENGINE] heartbeat | ticks=${status.ticksProcessed} | positions=${status.activePositions}`
    );
  }, 30000);

  // Fire one immediate tick
  setTimeout(() => {
    try {
      processTick();
    } catch (err) {
      console.error("[PULSAR ENGINE] Initial tick error:", err);
    }
  }, 100);

  console.log(`[PULSAR ENGINE] Engine started with tick interval: ${tickMs}ms`);
}

// Stop the trading engine
export async function stopEngine(): Promise<void> {
  if (!isEngineRunning()) {
    return;
  }

  console.log("[PULSAR ENGINE] Stopping engine...");
  
  // Clear timers
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  // Persist state before stopping
  await saveEngineState();

  stopEngineRuntime();
  console.log("[PULSAR ENGINE] Engine stopped");
}

// Process a single tick
export function processTick(): void {
  const state = getEngineState();
  const newPrices: Record<string, number> = { ...state.prices };
  const prevPrices: Record<string, number> = { ...state.prevPrices };
  const newCandlesCache: Record<string, { time: number; close: number }[]> = {
    ...state.candlesCache,
  };

  // Track which pairs got a NEW candle this tick
  const pairsWithNewCandle: string[] = [];

  // 1. Advance market for every enabled pair
  for (const pair of state.pairs) {
    if (!pair.enabled) continue;
    const { price, candle } = tickPair(pair);
    prevPrices[pair.symbol] = newPrices[pair.symbol] ?? price;
    newPrices[pair.symbol] = price;
    
    if (candle) {
      pairsWithNewCandle.push(pair.symbol);
    }

    // Update candle cache
    const prevArr = newCandlesCache[pair.symbol] ?? [];
    const arr = prevArr.length >= 120 ? prevArr.slice(1) : [...prevArr];
    arr.push({ time: candle?.time ?? Date.now(), close: price });
    newCandlesCache[pair.symbol] = arr;
  }

  // 2. Update open positions, close if stops/targets hit
  const stillOpen: Position[] = [];
  const closedTrades: Trade[] = [];
  let realizedDelta = 0;
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
      
      if (upd.outcome === "LOSS") {
        streakDelta[pos.strategy] = (streakDelta[pos.strategy] ?? 0) + 1;
      } else if (upd.outcome === "WIN") {
        streakDelta[pos.strategy] = (streakDelta[pos.strategy] ?? 0) - 100;
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
      newLossStreaks[strategy] = 0;
    }
  }

  // 3. Look for new signals & open positions - ONLY on new candle closes
  const allNewSignals: Signal[] = [];
  const openCountByPair: Record<string, number> = {};
  
  for (const p of stillOpen) {
    openCountByPair[p.pair] = (openCountByPair[p.pair] ?? 0) + 1;
  }

  const equity = state.startingBalance + state.realizedPnl + realizedDelta;
  
  for (const pair of state.pairs) {
    if (!pair.enabled) continue;
    if (!pairsWithNewCandle.includes(pair.symbol)) continue;
    
    const sigs = evaluateSignalsForPair(pair);
    for (const sig of sigs) {
      allNewSignals.push(sig);
      
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

  // DAILY LOSS LIMIT: If the account has lost more than 20% of starting balance, halt
  const currentEquity = state.startingBalance + realizedPnl;
  const lossPct = (currentEquity - state.startingBalance) / state.startingBalance;
  
  if (lossPct < -0.20 && isEngineRunning()) {
    console.log("[PULSAR ENGINE] 20% daily loss limit hit - stopping engine");
    stopEngineRuntime();
    
    const newState = getEngineState();
    newState.positions = stillOpen;
    newState.trades = trades;
    newState.signals = signals;
    newState.prices = newPrices;
    newState.prevPrices = prevPrices;
    newState.realizedPnl = realizedPnl;
    newState.candlesCache = newCandlesCache;
    newState.lossStreaks = newLossStreaks;
    newState.autoDisabled = newAutoDisabled;
    
    if (strategiesToDisable.length > 0) {
      newState.pairs = state.pairs.map((p) => ({
        ...p,
        strategies: {
          ...p.strategies,
          ...Object.fromEntries(strategiesToDisable.map((s) => [s, false])),
        },
      }));
    }
    
    setEngineState(newState);
    pushEquityPoint();
    return;
  }

  // Apply 7-loss-streak auto-disable
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

  // Update state
  const newState = getEngineState();
  newState.positions = stillOpen;
  newState.trades = trades;
  newState.signals = signals;
  newState.prices = newPrices;
  newState.prevPrices = prevPrices;
  newState.realizedPnl = realizedPnl;
  newState.candlesCache = newCandlesCache;
  newState.lossStreaks = newLossStreaks;
  newState.autoDisabled = newAutoDisabled;
  newState.pairs = finalPairs;
  
  setEngineState(newState);
  
  pushEquityPoint();
  incrementTicks();
}

// Push equity point to curve
export function pushEquityPoint(): void {
  const state = getEngineState();
  const unreal = state.positions.reduce((acc, p) => {
    const px = state.prices[p.pair] ?? p.entryPrice;
    const dir = p.side === "LONG" ? 1 : -1;
    return acc + (px - p.entryPrice) * p.size * dir;
  }, 0);
  
  const equity = state.startingBalance + state.realizedPnl + unreal;
  const last = state.equityCurve[state.equityCurve.length - 1];
  
  if (last && Date.now() - last.t < 1500) {
    state.equityCurve[state.equityCurve.length - 1] = { t: Date.now(), v: equity };
  } else {
    state.equityCurve.push({ t: Date.now(), v: equity });
  }
  
  if (state.equityCurve.length > 180) {
    state.equityCurve.shift();
  }
  
  setEngineState(state);
}

// Get engine status
export function getStatus(): EngineStatus {
  return getEngineStatus();
}

// Get full engine state (for API)
export function getFullState() {
  const state = getEngineState();
  return {
    ...state,
    status: getEngineStatus(),
  };
}

// Reset engine
export async function resetEngine(): Promise<void> {
  await stopEngine();
  
  const state = getEngineState();
  state.positions = [];
  state.trades = [];
  state.signals = [];
  state.realizedPnl = 0;
  state.equityCurve = [{ t: Date.now(), v: STARTING_BALANCE }];
  state.prices = Object.fromEntries(
    state.pairs.map((p) => [p.symbol, p.basePrice])
  );
  state.prevPrices = Object.fromEntries(
    state.pairs.map((p) => [p.symbol, p.basePrice])
  );
  state.candlesCache = {};
  state.runtime.ticksProcessed = 0;
  
  setEngineState(state);
  await saveEngineState();
}

// Update settings
export function updateEngineSettings(patch: Partial<EngineSettings>): void {
  const state = getEngineState();
  state.settings = { ...state.settings, ...patch };
  setEngineState(state);
}

// Toggle pair
export function togglePair(symbol: string): void {
  const state = getEngineState();
  state.pairs = state.pairs.map((p) =>
    p.symbol === symbol ? { ...p, enabled: !p.enabled } : p
  );
  setEngineState(state);
}

// Toggle pair strategy
export function togglePairStrategy(symbol: string, strategy: StrategyId): void {
  const state = getEngineState();
  state.pairs = state.pairs.map((p) =>
    p.symbol === symbol
      ? {
          ...p,
          strategies: {
            ...p.strategies,
            [strategy]: !p.strategies[strategy],
          },
        }
      : p
  );
  setEngineState(state);
}

// Close position manually
export function closePositionManually(id: string): void {
  const state = getEngineState();
  const pos = state.positions.find((p) => p.id === id);
  
  if (!pos) return;
  
  const exitPrice = state.prices[pos.pair] ?? pos.entryPrice;
  const dir = pos.side === "LONG" ? 1 : -1;
  const pnl = (exitPrice - pos.entryPrice) * pos.size * dir;
  const outcome = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN";
  const trade = positionToTrade(pos, exitPrice, "Manual close", outcome);
  
  state.positions = state.positions.filter((p) => p.id !== id);
  state.trades = [trade, ...state.trades].slice(0, 200);
  state.realizedPnl = state.realizedPnl + pnl;
  
  setEngineState(state);
  pushEquityPoint();
}

// Close all positions
export function closeAllPositions(): void {
  const state = getEngineState();
  
  if (state.positions.length === 0) return;
  
  let totalPnl = 0;
  const newTrades: Trade[] = [];
  
  for (const pos of state.positions) {
    const exitPrice = state.prices[pos.pair] ?? pos.entryPrice;
    const dir = pos.side === "LONG" ? 1 : -1;
    const pnl = (exitPrice - pos.entryPrice) * pos.size * dir;
    const outcome = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN";
    newTrades.push(positionToTrade(pos, exitPrice, "Closed all", outcome));
    totalPnl += pnl;
  }
  
  state.positions = [];
  state.trades = [...newTrades.reverse(), ...state.trades].slice(0, 200);
  state.realizedPnl = state.realizedPnl + totalPnl;
  
  setEngineState(state);
  pushEquityPoint();
}

// Reset loss streak
export function resetLossStreak(strategy: StrategyId): void {
  const state = getEngineState();
  state.lossStreaks = { ...state.lossStreaks, [strategy]: 0 };
  state.autoDisabled = { ...state.autoDisabled, [strategy]: false };
  
  state.pairs = state.pairs.map((p) => ({
    ...p,
    strategies: {
      ...p.strategies,
      [strategy]: true,
    },
  }));
  
  setEngineState(state);
}

// Clear history
export async function clearHistory(): Promise<void> {
  await stopEngine();
  
  const state = getEngineState();
  state.positions = [];
  state.trades = [];
  state.signals = [];
  state.realizedPnl = 0;
  state.equityCurve = [{ t: Date.now(), v: STARTING_BALANCE }];
  state.prices = Object.fromEntries(
    DEFAULT_PAIRS.map((p) => [p.symbol, p.basePrice])
  );
  state.prevPrices = Object.fromEntries(
    DEFAULT_PAIRS.map((p) => [p.symbol, p.basePrice])
  );
  state.candlesCache = {};
  state.runtime.ticksProcessed = 0;
  state.startingBalance = STARTING_BALANCE;
  
  setEngineState(state);
  await saveEngineState();
}

// Graceful shutdown
export async function gracefulShutdown(): Promise<void> {
  console.log("[PULSAR ENGINE] Graceful shutdown initiated");
  
  // Stop accepting new ticks
  await stopEngine();
  
  // Persist final state
  await saveEngineState();
  
  console.log("[PULSAR ENGINE] Graceful shutdown complete");
}

// Check if engine is initialized
export function isEngineInitialized(): boolean {
  return engineInitialized;
}

// Re-export types
export type { EngineStatus, PersistedEngineState };
