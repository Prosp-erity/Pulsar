import { NextResponse } from "next/server";
import {
  initializeEngine,
  isEngineInitialized,
  getFullState,
} from "@/lib/server/trading/trading-engine";

export const dynamic = "force-dynamic";

// GET /api/engine/state - Get full engine state
export async function GET() {
  if (!isEngineInitialized()) {
    try {
      await initializeEngine();
    } catch (err) {
      console.error("[PULSAR ENGINE] Failed to initialize:", err);
      return NextResponse.json(
        { error: "Failed to initialize engine" },
        { status: 500 }
      );
    }
  }

  const state = getFullState();
  
  // Return a subset of state that's safe to expose
  return NextResponse.json({
    running: state.runtime.running,
    startedAt: state.runtime.startedAt,
    lastTickAt: state.runtime.lastTickAt,
    ticksProcessed: state.runtime.ticksProcessed,
    lastHeartbeatAt: state.runtime.lastHeartbeatAt,
    pairs: state.pairs,
    settings: state.settings,
    positions: state.positions,
    trades: state.trades,
    signals: state.signals,
    startingBalance: state.startingBalance,
    realizedPnl: state.realizedPnl,
    equityCurve: state.equityCurve,
    prices: state.prices,
    prevPrices: state.prevPrices,
    lossStreaks: state.lossStreaks,
    autoDisabled: state.autoDisabled,
  });
}
