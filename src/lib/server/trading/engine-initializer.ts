// Trading engine initializer
// This module should be imported early in the server process to start the engine

import {
  initializeEngine,
  isEngineInitialized,
  startEngine,
  getStatus,
  startAutoSave,
} from "./trading-engine";

// Track initialization
let initialized = false;

/**
 * Initialize the trading engine
 * Call this once at server startup
 */
export async function initializeTradingEngine(): Promise<void> {
  if (initialized) return;
  
  initialized = true;
  
  console.log("[PULSAR ENGINE INITIALIZER] Starting server-side trading engine...");

  try {
    // Initialize engine (loads persisted state)
    await initializeEngine();
    
    // Start auto-save (every 30 seconds)
    startAutoSave(30000);
    
    // Ensure engine is running
    const { isEngineRunning } = await import("./trading-engine");
    if (!isEngineRunning()) {
      await startEngine();
    }
    
    const status = getStatus();
    console.log(
      `[PULSAR ENGINE INITIALIZER] Trading engine started successfully | ` +
      `running=${status.running} | ` +
      `ticks=${status.ticksProcessed} | ` +
      `positions=${status.activePositions}`
    );
  } catch (err) {
    console.error("[PULSAR ENGINE INITIALIZER] Failed to initialize:", err);
    throw err;
  }
}

/**
 * Auto-initialize when module is imported in server context
 * This ensures the engine starts as early as possible
 */
if (typeof window === "undefined") {
  // We're on the server - initialize immediately
  initializeTradingEngine().catch((err) => {
    console.error("[PULSAR ENGINE INITIALIZER] Background initialization failed:", err);
  });
}

// Re-export everything
export * from "./trading-engine";
