import { NextResponse } from "next/server";
import {
  initializeEngine,
  isEngineInitialized,
  startEngine,
  stopEngine,
  resetEngine,
  updateEngineSettings,
  togglePair,
  togglePairStrategy,
  closePositionManually,
  closeAllPositions,
  resetLossStreak,
  clearHistory,
  getFullState,
} from "@/lib/server/trading/trading-engine";
import type { EngineSettings, StrategyId } from "@/lib/trading/types";

export const dynamic = "force-dynamic";

// POST /api/engine/control - Engine control actions
export async function POST(request: Request) {
  if (!isEngineInitialized()) {
    await initializeEngine();
  }

  const body = await request.json();
  const action = body.action as string;

  try {
    switch (action) {
      case "start":
        await startEngine();
        return NextResponse.json({ success: true, message: "Engine started" });

      case "stop":
        await stopEngine();
        return NextResponse.json({ success: true, message: "Engine stopped" });

      case "reset":
        await resetEngine();
        return NextResponse.json({ success: true, message: "Engine reset" });

      case "updateSettings":
        updateEngineSettings(body.patch as Partial<EngineSettings>);
        return NextResponse.json({ success: true, message: "Settings updated" });

      case "togglePair":
        const symbol = body.symbol as string;
        togglePair(symbol);
        return NextResponse.json({ success: true, message: `Pair ${symbol} toggled` });

      case "togglePairStrategy":
        const pairSymbol = body.symbol as string;
        const strategy = body.strategy as StrategyId;
        togglePairStrategy(pairSymbol, strategy);
        return NextResponse.json({ 
          success: true, 
          message: `Strategy ${strategy} toggled for ${pairSymbol}` 
        });

      case "closePosition":
        const positionId = body.id as string;
        closePositionManually(positionId);
        return NextResponse.json({ success: true, message: `Position ${positionId} closed` });

      case "closeAllPositions":
        closeAllPositions();
        return NextResponse.json({ success: true, message: "All positions closed" });

      case "resetLossStreak":
        const streakStrategy = body.strategy as StrategyId;
        resetLossStreak(streakStrategy);
        return NextResponse.json({ 
          success: true, 
          message: `Loss streak reset for ${streakStrategy}` 
        });

      case "clearHistory":
        await clearHistory();
        return NextResponse.json({ success: true, message: "History cleared" });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[PULSAR ENGINE] Control error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
