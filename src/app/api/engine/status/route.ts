import { NextResponse } from "next/server";
import {
  initializeEngine,
  getStatus,
  isEngineInitialized,
  startEngine,
  stopEngine,
  getFullState,
} from "@/lib/server/trading/trading-engine";

// Ensure engine is initialized on first request
export const dynamic = "force-dynamic";

// GET /api/engine/status - Get engine status
export async function GET() {
  // Lazy initialization - start engine if not already running
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

  const status = getStatus();
  return NextResponse.json(status);
}

// POST /api/engine/status - Control engine (start/stop)
export async function POST(request: Request) {
  const body = await request.json();
  const action = body.action as "start" | "stop";

  if (!isEngineInitialized()) {
    await initializeEngine();
  }

  switch (action) {
    case "start":
      await startEngine();
      return NextResponse.json({ success: true, message: "Engine started" });
    case "stop":
      await stopEngine();
      return NextResponse.json({ success: true, message: "Engine stopped" });
    default:
      return NextResponse.json(
        { error: "Invalid action. Use 'start' or 'stop'" },
        { status: 400 }
      );
  }
}
