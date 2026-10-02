// Server-side trading engine entry point
// Import this module early in your application to ensure the engine starts

import { startupEngine } from "./startup";

// Auto-start the engine when this module is imported
// This happens when the server starts
if (typeof window === "undefined") {
  // We're on the server
  startupEngine().catch((err) => {
    console.error("[PULSAR ENGINE] Failed to auto-start:", err);
  });
}

// Re-export all engine functions
export * from "./trading-engine";
export * from "./trading-engine-state";
export * from "./trading-engine-persistence";
export * from "./startup";
