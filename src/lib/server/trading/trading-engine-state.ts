// Server-side trading engine state management
// This module maintains the authoritative trading state on the server

import type {
  Position,
  Trade,
  Signal,
  PairConfig,
  EngineSettings,
  Candle,
  StrategyId,
} from "@/lib/trading/types";

// Engine runtime state
export interface EngineRuntimeState {
  running: boolean;
  startedAt: number | null;
  lastTickAt: number | null;
  ticksProcessed: number;
  lastHeartbeatAt: number | null;
  heartbeatInterval: number;
}

// Full engine state that can be persisted
export interface PersistedEngineState {
  version: number;
  savedAt: number;
  runtime: EngineRuntimeState;
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
  candlesCache: Record<string, { time: number; close: number }[]>;
  lossStreaks: Record<StrategyId, number>;
  autoDisabled: Record<StrategyId, boolean>;
}

// Default initial state
export const INITIAL_ENGINE_STATE: PersistedEngineState = {
  version: 1,
  savedAt: 0,
  runtime: {
    running: false,
    startedAt: null,
    lastTickAt: null,
    ticksProcessed: 0,
    lastHeartbeatAt: null,
    heartbeatInterval: 30000, // 30 seconds
  },
  pairs: [],
  settings: {
    leverage: 2,
    riskPerTradePct: 0.5,
    maxPositionsPerPair: 2,
    maxTotalPositions: 12,
    defaultStopPct: 0.008,
    defaultTargetPct: 0.012,
    tickMs: 1500,
  },
  positions: [],
  trades: [],
  signals: [],
  startingBalance: 25000,
  realizedPnl: 0,
  equityCurve: [],
  prices: {},
  prevPrices: {},
  candlesCache: {},
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
};

// Singleton engine state
let engineState: PersistedEngineState = { ...INITIAL_ENGINE_STATE };

// Lock to prevent concurrent modifications
export const stateLock = {
  locked: false,
  async acquire<T>(fn: () => T): Promise<T> {
    while (this.locked) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    this.locked = true;
    try {
      return fn();
    } finally {
      this.locked = false;
    }
  },
};

// Get current state (read-only)
export function getEngineState(): PersistedEngineState {
  return { ...engineState };
}

// Get runtime state only
export function getRuntimeState(): EngineRuntimeState {
  return { ...engineState.runtime };
}

// Update full state
export function setEngineState(newState: PersistedEngineState): void {
  engineState = { ...newState };
}

// Update runtime state
export function updateRuntimeState(partial: Partial<EngineRuntimeState>): void {
  engineState.runtime = { ...engineState.runtime, ...partial };
}

// Update partial state
export function updateEngineState(partial: Partial<PersistedEngineState>): void {
  engineState = { ...engineState, ...partial };
}

// Increment tick counter
export function incrementTicks(): void {
  engineState.runtime.ticksProcessed += 1;
  engineState.runtime.lastTickAt = Date.now();
}

// Update heartbeat
export function updateHeartbeat(): void {
  engineState.runtime.lastHeartbeatAt = Date.now();
}

// Reset engine state
export function resetEngineState(): void {
  engineState = {
    ...INITIAL_ENGINE_STATE,
    runtime: {
      ...INITIAL_ENGINE_STATE.runtime,
      ticksProcessed: 0,
    },
  };
}

// Check if engine is running
export function isEngineRunning(): boolean {
  return engineState.runtime.running;
}

// Start the engine
export function startEngineRuntime(): void {
  engineState.runtime = {
    ...engineState.runtime,
    running: true,
    startedAt: Date.now(),
    lastTickAt: Date.now(),
    lastHeartbeatAt: Date.now(),
  };
}

// Stop the engine
export function stopEngineRuntime(): void {
  engineState.runtime = {
    ...engineState.runtime,
    running: false,
  };
}

// Get engine status for API
export interface EngineStatus {
  running: boolean;
  startedAt: string | null;
  lastHeartbeat: string | null;
  ticksProcessed: number;
  activePositions: number;
  totalTrades: number;
  uptimeSeconds: number | null;
}

export function getEngineStatus(): EngineStatus {
  const state = getEngineState();
  const runtime = state.runtime;
  
  const uptimeSeconds = runtime.startedAt
    ? Math.floor((Date.now() - runtime.startedAt) / 1000)
    : null;

  return {
    running: runtime.running,
    startedAt: runtime.startedAt ? new Date(runtime.startedAt).toISOString() : null,
    lastHeartbeat: runtime.lastHeartbeatAt 
      ? new Date(runtime.lastHeartbeatAt).toISOString()
      : null,
    ticksProcessed: runtime.ticksProcessed,
    activePositions: state.positions.length,
    totalTrades: state.trades.length,
    uptimeSeconds,
  };
}
