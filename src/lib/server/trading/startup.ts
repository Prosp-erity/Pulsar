// Server startup hook for the trading engine
// This module ensures the engine starts when the Next.js server starts

import {
  initializeEngine,
  isEngineInitialized,
  startEngine,
  isEngineRunning,
  getStatus,
} from "./trading-engine";

// Flag to track if startup has been attempted
let startupAttempted = false;

/**
 * Initialize the trading engine on server startup
 * This should be called once when the server process starts
 */
export async function startupEngine(): Promise<void> {
  if (startupAttempted) {
    return;
  }

  startupAttempted = true;
  
  console.log("[PULSAR STARTUP] Initializing trading engine...");

  try {
    // Initialize the engine (loads persisted state, sets up timers)
    await initializeEngine();
    
    // If engine isn't running, start it
    if (!isEngineRunning()) {
      await startEngine();
    }
    
    const status = getStatus();
    console.log(
      `[PULSAR STARTUP] Trading engine initialized | ` +
      `running=${status.running} | ` +
      `ticks=${status.ticksProcessed} | ` +
      `positions=${status.activePositions}`
    );
  } catch (err) {
    console.error("[PULSAR STARTUP] Failed to initialize trading engine:", err);
  }
}

/**
 * Ensure startup is called
 * This is a simple way to trigger startup when the module is imported
 */
if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "development") {
  // In Node.js server context, startup immediately
  if (typeof window === "undefined") {
    // Delay slightly to allow other modules to load
    setTimeout(() => {
      startupEngine().catch(console.error);
    }, 100);
  }
}

// Re-export for convenience
export {
  initializeEngine,
  isEngineInitialized,
  startEngine,
  isEngineRunning,
  getStatus,
} from "./trading-engine";
