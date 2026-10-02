// Server-side persistence for the trading engine
// Uses Prisma for database persistence when available, falls back to in-memory

import { PrismaClient } from "@prisma/client";
import type {
  Position,
  Trade,
  Signal,
  PairConfig,
  EngineSettings,
  StrategyId,
} from "@/lib/trading/types";

import {
  getEngineState,
  setEngineState,
  getRuntimeState,
  type PersistedEngineState,
  type EngineRuntimeState,
  INITIAL_ENGINE_STATE,
} from "./trading-engine-state";

// In-memory storage (fallback when DB not available)
let inMemoryState: PersistedEngineState | null = null;

// Prisma client singleton
let prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient | null {
  if (prisma) return prisma;
  
  try {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query"] : [],
    });
    return prisma;
  } catch (err) {
    console.warn("[PULSAR PERSISTENCE] Could not initialize Prisma:", err);
    return null;
  }
}

// Initialize persistence system
export async function initPersistence(): Promise<void> {
  const db = getPrisma();
  
  if (db) {
    // Ensure the TradingState table exists (we'll use a generic approach)
    // For SQLite, we need to check if we can write to it
    try {
      // Test connection
      await db.$queryRaw`SELECT 1`;
      console.log("[PULSAR PERSISTENCE] Database connection established");
    } catch (err) {
      console.warn("[PULSAR PERSISTENCE] Database not available, using in-memory:", err);
    }
  }
}

// Save engine state to database
export async function saveEngineState(): Promise<void> {
  const state = getEngineState();
  const runtime = getRuntimeState();
  
  const db = getPrisma();
  
  if (db) {
    try {
      // Create a compact snapshot for persistence
      const snapshot = createPersistedSnapshot(state);
      
      // Use a simple key-value store approach
      // In a real deployment, you'd want a proper TradingState table
      // For now, we'll use a simple approach with a single row
      
      await db.$executeRaw`
        INSERT OR REPLACE INTO EngineState (id, data, updatedAt) 
        VALUES (1, ${JSON.stringify(snapshot)}, datetime('now'))
      `;
      
      console.log("[PULSAR PERSISTENCE] State saved to database");
    } catch (err) {
      console.warn("[PULSAR PERSISTENCE] Failed to save to database:", err);
      // Fall back to in-memory
      inMemoryState = { ...state };
    }
  } else {
    // No database, use in-memory
    inMemoryState = { ...state };
    console.log("[PULSAR PERSISTENCE] State saved to in-memory storage");
  }
}

// Load engine state from database
export async function loadEngineState(): Promise<PersistedEngineState | null> {
  const db = getPrisma();
  
  if (db) {
    try {
      const result = await db.$queryRaw`
        SELECT data FROM EngineState WHERE id = 1 LIMIT 1
      ` as { data: string }[];
      
      if (result && result[0] && result[0].data) {
        const snapshot = JSON.parse(result[0].data) as PersistedEngineState;
        console.log("[PULSAR PERSISTENCE] State loaded from database");
        return snapshot;
      }
    } catch (err) {
      console.warn("[PULSAR PERSISTENCE] Failed to load from database:", err);
    }
  }
  
  // Try in-memory fallback
  if (inMemoryState) {
    console.log("[PULSAR PERSISTENCE] State loaded from in-memory storage");
    return inMemoryState;
  }
  
  return null;
}

// Create a compact snapshot for persistence
function createPersistedSnapshot(state: PersistedEngineState): PersistedEngineState {
  return {
    ...state,
    // Trim arrays to prevent unbounded growth
    trades: state.trades.slice(0, 200),
    signals: state.signals.slice(0, 80),
    equityCurve: state.equityCurve.slice(-180),
    // Clear transient data that shouldn't be persisted
    candlesCache: {},
  };
}

// Auto-save on interval
export function startAutoSave(intervalMs: number = 3000): void {
  setInterval(async () => {
    try {
      await saveEngineState();
    } catch (err) {
      console.error("[PULSAR PERSISTENCE] Auto-save error:", err);
    }
  }, intervalMs);
}

// Force immediate save
export async function flushSave(): Promise<void> {
  await saveEngineState();
}

// Clear persisted state
export async function clearPersistedState(): Promise<void> {
  const db = getPrisma();
  
  if (db) {
    try {
      await db.$executeRaw`DELETE FROM EngineState WHERE id = 1`;
    } catch (err) {
      console.warn("[PULSAR PERSISTENCE] Failed to clear database state:", err);
    }
  }
  
  inMemoryState = null;
}
