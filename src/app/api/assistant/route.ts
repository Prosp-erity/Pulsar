"use server";

import ZAI from "z-ai-web-dev-sdk";

interface AssistantRequest {
  message: string;
  modelProvider?: "zai" | "openrouter" | "nvidia";
  openrouterKey?: string;
  nvidiaKey?: string;
  appState: {
    running: boolean;
    equity: number;
    realizedPnl: number;
    unrealizedPnl: number;
    startingBalance: number;
    totalReturn: number;
    openPositions: number;
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    settings: {
      riskPerTradePct: number;
      leverage: number;
      maxPositionsPerPair: number;
      maxTotalPositions: number;
      defaultStopPct: number;
      defaultTargetPct: number;
      tickMs: number;
    };
    pairs: { symbol: string; enabled: boolean; strategies: Record<string, boolean> }[];
    activeView: string;
    strategies: { id: string; name: string; type: string }[];
    lossStreaks: Record<string, number>;
    autoDisabled: Record<string, boolean>;
  };
}

interface AssistantAction {
  type: string;
  payload?: Record<string, unknown>;
}

interface AssistantResponse {
  message: string;
  actions: AssistantAction[];
}

const SYSTEM_PROMPT = `You are Pulsar AI, the built-in copilot assistant for the Pulsar crypto trading app. You can see the entire app state and control it by issuing actions.

You know EVERYTHING about the app:

**Strategies (5):**
- Momentum Rider (session_orb): Goes LONG when EMA9 > EMA21 > EMA50 + RSI2 > 50. Trend-following, catches momentum early. ~6 trades/day.
- Trend Rider (vwap_fade_pro): Goes LONG when price > EMA20 + RSI2 < 50. Buys pullbacks in uptrends. ~10 trades/day.
- VWAP Bounce Scalper (connors_rsi): Goes LONG when price touches session VWAP in an uptrend. Institutional fair-value bounce. ~6 trades/day.
- Trend Pullback Pro (bb_squeeze_mtf): Goes LONG when price pulls back to EMA21 in an uptrend with RSI2 < 40. High-precision entries. ~4 trades/day.
- Engulfing Pin Bar (liquidity_sweep): Pure price action — detects engulfing candles with rejection wicks at EMA50. No indicators beyond EMA50. ~4 trades/day.

**Trading Pairs (6):** BTC/USDT, ETH/USDT, SOL/USDT, AVAX/USDT, DOGE/USDT, ARB/USDT

**Engine Controls:**
- Start/stop/reset the engine
- Tick speed adjustable (500ms - 4000ms)
- Candle-boundary signal evaluation (strategies only evaluate on candle close, not every tick)
- Web Worker runs the engine so it keeps trading when the tab is in background

**Settings (all adjustable via actions):**
- Risk per trade % (0.1% - 5%)
- Leverage (1x - 20x)
- Max positions per pair (1-5)
- Max total positions (2-30)
- Stop loss % (0.1% - 2%)
- Take profit % (0.4% - 3%)
- Tick speed (500ms - 4000ms)

**Risk Management:**
- 10% max notional cap per trade (no single trade can exceed 10% of equity)
- 20% daily loss circuit breaker (engine halts if account drops 20%)
- 7-loss-streak auto-disable (strategy disabled after 7 consecutive losses)
- Dynamic trailing stop (Phase 1: breakeven at +0.2% profit; Phase 2: trails 50% of profit at +0.4%)
- Close-based stops with 2-tick confirmation (filters intrabar noise)
- Per-strategy inversion flags (can flip signal direction per strategy)

**Views:** dashboard, backtest, strategies, risk, assistant (this chat), live

**Backtesting:** 3-month / 90-day backtests on 5-minute candles across all 6 pairs. Shows equity curve, drawdown, monthly returns, trade P&L distribution, and trade-by-trade log.

**Live Trading:** Supports Binance API, MetaAPI, and MT5 Bridge (free custom EA + REST server).

**Persistent Memory:** All positions, trades, P&L, and settings saved to localStorage. Survives page reloads.

**Actions you can issue (return as JSON array):**
- {"type":"startEngine"}
- {"type":"stopEngine"}
- {"type":"resetEngine"}
- {"type":"setView","payload":{"view":"dashboard"}}
- {"type":"updateSettings","payload":{"riskPerTradePct":0.5}}
- {"type":"updateSettings","payload":{"leverage":2}}
- {"type":"updateSettings","payload":{"maxPositionsPerPair":2}}
- {"type":"updateSettings","payload":{"maxTotalPositions":12}}
- {"type":"updateSettings","payload":{"defaultStopPct":0.004}}
- {"type":"updateSettings","payload":{"defaultTargetPct":0.004}}
- {"type":"setTickMs","payload":{"ms":1500}}
- {"type":"togglePair","payload":{"symbol":"BTC/USDT"}}
- {"type":"toggleStrategy","payload":{"strategy":"session_orb"}}
- {"type":"closeAllPositions"}
- {"type":"clearHistory"}
- {"type":"runBacktests"}
- {"type":"resetLossStreak","payload":{"strategy":"session_orb"}}

Strategy IDs: connors_rsi (VWAP Bounce Scalper), vwap_fade_pro (Trend Rider), liquidity_sweep (Engulfing Pin Bar), session_orb (Momentum Rider), bb_squeeze_mtf (Trend Pullback Pro)

**Rules:**
- Be friendly, concise, and proactive (1-4 sentences max)
- When the user asks to change something, issue the action AND confirm what you did
- When the user asks about performance, read from the app state in the message and give specific numbers
- Be proactive: if engine is stopped, suggest starting it. If a strategy is losing, suggest toggling it off. If risk is too high, suggest lowering it.
- If a strategy has a loss streak >= 5, warn the user it's approaching auto-disable
- If a strategy is auto-disabled, inform the user and offer to reset the streak
- When discussing profits, add "⚠ Educational simulation" disclaimer
- If the user asks how something works, explain it clearly using the knowledge above
- If the user asks what you can do, list your capabilities
- Suggest optimizations when you see opportunities (e.g., "Momentum Rider has 65% WR — consider increasing its allocation")

Return your response as JSON: {"message":"your text response","actions":[...actions]}`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AssistantRequest;

    const provider = body.modelProvider || "zai";

    const userContent = `User message: "${body.message}"

Current app state:
- Engine: ${body.appState.running ? "RUNNING" : "STOPPED"}
- Equity: $${body.appState.equity.toFixed(2)}
- Starting balance: $${body.appState.startingBalance.toFixed(2)}
- Realized P&L: $${body.appState.realizedPnl.toFixed(2)}
- Unrealized P&L: $${body.appState.unrealizedPnl.toFixed(2)}
- Total return: ${body.appState.totalReturn.toFixed(2)}%
- Open positions: ${body.appState.openPositions}
- Total trades: ${body.appState.totalTrades}
- Wins: ${body.appState.wins}, Losses: ${body.appState.losses}
- Win rate: ${body.appState.winRate.toFixed(1)}%

Settings:
- Risk per trade: ${body.appState.settings.riskPerTradePct}%
- Leverage: ${body.appState.settings.leverage}x
- Max positions per pair: ${body.appState.settings.maxPositionsPerPair}
- Max total positions: ${body.appState.settings.maxTotalPositions}
- Stop loss: ${(body.appState.settings.defaultStopPct * 100).toFixed(2)}%
- Take profit: ${(body.appState.settings.defaultTargetPct * 100).toFixed(2)}%
- Tick speed: ${(body.appState.settings.tickMs / 1000).toFixed(2)}s

Pairs: ${body.appState.pairs.map(p => `${p.symbol}(${p.enabled ? "ON" : "OFF"})`).join(", ")}

Strategies: ${body.appState.strategies.map(s => `${s.name} (${s.id}, ${s.type})`).join(", ")}

Loss streaks: ${JSON.stringify(body.appState.lossStreaks)}
Auto-disabled: ${JSON.stringify(body.appState.autoDisabled)}
Current view: ${body.appState.activeView}

Per-strategy pair config:
${body.appState.pairs.map(p => `${p.symbol}: ${Object.entries(p.strategies).filter(([k,v]) => v).map(([k]) => k).join(", ") || "none"}`).join("\n")}`;

    let content = "";

    if (provider === "openrouter" && body.openrouterKey) {
      // Call OpenRouter API
      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${body.openrouterKey}`,
        },
        body: JSON.stringify({
          model: "anthropic/claude-3.5-sonnet",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });
      const orData = await orRes.json();
      content = orData.choices?.[0]?.message?.content || "";
    } else if (provider === "nvidia" && body.nvidiaKey) {
      // Call NVIDIA API
      const nvRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${body.nvidiaKey}`,
        },
        body: JSON.stringify({
          model: "nvidia/llama-3.1-nemotron-70b-instruct",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });
      const nvData = await nvRes.json();
      content = nvData.choices?.[0]?.message?.content || "";
    } else {
      // Default: ZAI
      const zai = await ZAI.create();
      const response = await zai.chat.completions.create({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });
      content = response.choices[0]?.message?.content || "";
    }

    // Try to parse as JSON
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as AssistantResponse;
        return Response.json({
          message: parsed.message || content,
          actions: parsed.actions || [],
        });
      }
    } catch {
      // If JSON parsing fails, return as plain text
    }

    return Response.json({
      message: content,
      actions: [],
    });
  } catch (error) {
    console.error("[assistant] Error:", error);
    return Response.json(
      {
        message: "I had trouble processing that. Please try again.",
        actions: [],
      },
      { status: 200 },
    );
  }
}
