// The trading engine. Pure logic that:
//   1. Receives the latest price for each pair
//   2. Asks each enabled strategy to evaluate the candle history
//   3. Opens new positions subject to risk limits
//   4. Manages open positions (stop / target / time exit)
//   5. Emits closed trades with realized P&L
//
// The Zustand store (trading-store.ts) owns engine state and the tick
// loop. This module exports pure helpers so the engine is testable.

import { getCandles, getRecentCloses } from "./market";
import { STRATEGIES } from "./strategies";
import type {
  Candle,
  EngineSettings,
  PairConfig,
  Position,
  Side,
  Signal,
  StrategyId,
  Trade,
} from "./types";

let _id = 0;
export function nextId(prefix: string): string {
  _id += 1;
  return `${prefix}_${Date.now().toString(36)}_${_id.toString(36)}`;
}

export const DEFAULT_PAIRS: PairConfig[] = [
  {
    symbol: "BTC/USDT",
    basePrice: 64250,
    volatility: 0.62,
    drift: 0.18,
    enabled: true,
    strategies: {
      connors_rsi: true,
      vwap_fade_pro: true,
      liquidity_sweep: true,
      session_orb: true,
      bb_squeeze_mtf: true,
    },
  },
  {
    symbol: "ETH/USDT",
    basePrice: 3142,
    volatility: 0.78,
    drift: 0.22,
    enabled: true,
    strategies: {
      connors_rsi: true,
      vwap_fade_pro: true,
      liquidity_sweep: true,
      session_orb: true,
      bb_squeeze_mtf: true,
    },
  },
  {
    symbol: "SOL/USDT",
    basePrice: 142.7,
    volatility: 1.05,
    drift: 0.28,
    enabled: true,
    strategies: {
      connors_rsi: true,
      vwap_fade_pro: true,
      liquidity_sweep: true,
      session_orb: true,
      bb_squeeze_mtf: true,
    },
  },
  {
    symbol: "AVAX/USDT",
    basePrice: 27.4,
    volatility: 1.18,
    drift: 0.15,
    enabled: true,
    strategies: {
      connors_rsi: true,
      vwap_fade_pro: true,
      liquidity_sweep: true,
      session_orb: true,
      bb_squeeze_mtf: true,
    },
  },
  {
    symbol: "DOGE/USDT",
    basePrice: 0.1245,
    volatility: 1.42,
    drift: 0.1,
    enabled: true,
    strategies: {
      connors_rsi: true,
      vwap_fade_pro: true,
      liquidity_sweep: true,
      session_orb: true,
      bb_squeeze_mtf: true,
    },
  },
  {
    symbol: "ARB/USDT",
    basePrice: 0.872,
    volatility: 1.32,
    drift: 0.12,
    enabled: true,
    strategies: {
      connors_rsi: true,
      vwap_fade_pro: true,
      liquidity_sweep: true,
      session_orb: true,
      bb_squeeze_mtf: true,
    },
  },
];

export const DEFAULT_SETTINGS: EngineSettings = {
  leverage: 2,
  riskPerTradePct: 0.5,
  maxPositionsPerPair: 2,
  maxTotalPositions: 12,
  defaultStopPct: 0.008,
  defaultTargetPct: 0.012,
  tickMs: 1500,
};

export interface EngineSnapshot {
  positions: Position[];
  trades: Trade[];
  signals: Signal[];
  strategyStats: Record<StrategyId, { pnl: number; trades: number; wins: number }>;
}

// Per-strategy inversion flag. When true, the signal direction is flipped.
// All 5 strategies are now trend-following — none need inversion.
export const INVERT_STRATEGY: Record<StrategyId, boolean> = {
  connors_rsi: false,    // Momentum Dip Buyer
  vwap_fade_pro: false,  // Trend Rider
  liquidity_sweep: false, // Engulfing Pin Bar — new, no inversion
  session_orb: false,    // Momentum Rider
  bb_squeeze_mtf: false, // Trend Pullback Pro
};

export function evaluateSignalsForPair(pair: PairConfig): Signal[] {
  const candles = getCandles(pair.symbol, 220);
  const closes = getRecentCloses(pair.symbol, 220);
  if (candles.length < 50 || closes.length < 50) return [];
  const out: Signal[] = [];
  const ts = Date.now();
  for (const id of Object.keys(pair.strategies) as StrategyId[]) {
    if (!pair.strategies[id] || !pair.enabled) continue;
    const strat = STRATEGIES[id];
    if (!strat) continue;
    const sig = strat.evaluate(candles, closes);
    if (sig) {
      const invert = INVERT_STRATEGY[id] ?? false;
      const finalSide = invert
        ? (sig.side === "LONG" ? "SHORT" : "LONG") as Side
        : sig.side;
      out.push({
        ...sig,
        side: finalSide,
        pair: pair.symbol,
        reason: invert ? `[INVERTED] ${sig.reason}` : sig.reason,
        ts,
      });
    }
  }
  return out;
}

// Per-strategy stop/target parameters — 1:1 R:R so even 55% WR is profitable.
// Previous config (tight target, wide stop) needed 77%+ WR to break even,
// which is why the system lost money at 67% WR.
export const STRATEGY_PARAMS: Record<
  StrategyId,
  { stopPct: number; targetPct: number; maxHoldMs: number }
> = {
  connors_rsi: { stopPct: 0.004, targetPct: 0.004, maxHoldMs: 20 * 5 * 60 * 1000 },
  vwap_fade_pro: { stopPct: 0.004, targetPct: 0.004, maxHoldMs: 25 * 5 * 60 * 1000 },
  liquidity_sweep: { stopPct: 0.004, targetPct: 0.004, maxHoldMs: 30 * 5 * 60 * 1000 },
  session_orb: { stopPct: 0.005, targetPct: 0.005, maxHoldMs: 60 * 5 * 60 * 1000 },
  bb_squeeze_mtf: { stopPct: 0.005, targetPct: 0.005, maxHoldMs: 40 * 5 * 60 * 1000 },
};

export interface OpenPositionInput {
  pair: PairConfig;
  signal: Signal;
  price: number;
  equity: number;
  settings: EngineSettings;
  openCountForPair: number;
  totalOpen: number;
}

export function buildPositionFromSignal(
  input: OpenPositionInput,
): Position | null {
  const { pair, signal, price, equity, settings, openCountForPair, totalOpen } = input;
  if (openCountForPair >= settings.maxPositionsPerPair) return null;
  if (totalOpen >= settings.maxTotalPositions) return null;
  // Use per-strategy stop/target (matches backtest) instead of global defaults
  const stratParams = STRATEGY_PARAMS[signal.strategy];
  const stopPct = stratParams.stopPct;
  const targetPct = stratParams.targetPct;
  // Risk-based sizing: risk amount = equity * riskPct
  const riskAmount = equity * (settings.riskPerTradePct / 100);
  const stopDist = price * stopPct;
  const sizeByRisk = stopDist > 0 ? riskAmount / stopDist : 0;
  // Cap by leverage on equity
  const maxSizeByLeverage = (equity * settings.leverage) / price;
  // SAFETY CAP: Maximum notional per trade = 10% of equity.
  // This prevents the death-spiral where compounding profits create
  // enormous position sizes that can wipe the account on a single loss.
  // Without this cap, a $100K account could open $500K positions (5x lev),
  // and a single stop-out would lose $50K+ (50% of equity).
  const maxNotional = equity * 0.10; // max 10% of equity per trade
  const maxSizeByNotional = maxNotional / price;
  // Final size: risk-based × strength, capped by BOTH leverage AND notional
  // NOTE: Removed the ×2 multiplier that was doubling risk beyond the
  // configured percentage. That was the #1 cause of account wipes.
  const size = Math.max(
    0,
    Math.min(sizeByRisk * signal.strength, maxSizeByLeverage, maxSizeByNotional),
  );
  if (size <= 0) return null;
  const notional = size * price;
  if (notional < 1) return null;
  const stop =
    signal.side === "LONG"
      ? price * (1 - stopPct)
      : price * (1 + stopPct);
  const target =
    signal.side === "LONG"
      ? price * (1 + targetPct)
      : price * (1 - targetPct);
  return {
    id: nextId("pos"),
    pair: pair.symbol,
    side: signal.side as Side,
    strategy: signal.strategy,
    entryPrice: price,
    size,
    notional,
    stop,
    target,
    openedAt: Date.now(),
    unrealizedPnl: 0,
    status: "OPEN",
  };
}

export interface PositionUpdate {
  position: Position;
  price: number;
  settings: EngineSettings;
}

export interface PositionUpdateResult {
  position: Position;
  shouldClose: boolean;
  closeReason: string;
  pnl: number;
  pnlPct: number;
  outcome: "WIN" | "LOSS" | "BREAKEVEN";
}

export function updatePosition(input: PositionUpdate): PositionUpdateResult {
  const { position, price, settings } = input;
  const dir = position.side === "LONG" ? 1 : -1;
  const pnl = (price - position.entryPrice) * position.size * dir;
  const pnlPct = (pnl / position.notional) * 100;
  const STOP_CONFIRM_TICKS = 2;
  let stopConfirm = position.stopConfirmTicks ?? 0;

  // DYNAMIC TRAILING STOP: Instead of just moving to breakeven, this
  // trails the stop behind the highest favorable price reached. The
  // stop sits at 50% of the max profit — so if price runs +1%, the
  // stop moves to +0.5%, locking in half the gains while letting the
  // trade continue to profit.
  //
  // Phase 1 (profit > 0.2%): Move stop to breakeven (entry price)
  // Phase 2 (profit > 0.4%): Trail stop to 50% of max favorable excursion
  let trailingStop = position.stop;
  const profitPct = pnlPct / 100; // decimal
  if (profitPct > 0.002) {
    // Phase 1: At least breakeven
    if (position.side === "LONG") {
      trailingStop = Math.max(position.stop, position.entryPrice);
      // Phase 2: Dynamic trailing — lock in 50% of current profit
      if (profitPct > 0.004) {
        const halfProfit = position.entryPrice * (1 + profitPct * 0.5);
        trailingStop = Math.max(trailingStop, halfProfit);
      }
    } else {
      trailingStop = Math.min(position.stop, position.entryPrice);
      if (profitPct > 0.004) {
        const halfProfit = position.entryPrice * (1 - profitPct * 0.5);
        trailingStop = Math.min(trailingStop, halfProfit);
      }
    }
  }

  const updated: Position = {
    ...position,
    unrealizedPnl: pnl,
    stop: trailingStop, // update the stop to the trailing level
  };
  let shouldClose = false;
  let closeReason = "";
  let outcome: "WIN" | "LOSS" | "BREAKEVEN" = "BREAKEVEN";

  // Target: check intrabar (fill as soon as price reaches target)
  // Stop: require STOP_CONFIRM_TICKS consecutive ticks past stop (close-based)
  if (position.side === "LONG") {
    if (price >= position.target) {
      shouldClose = true;
      closeReason = "Take-profit hit";
      outcome = "WIN";
    } else if (price <= trailingStop) {
      stopConfirm += 1;
      if (stopConfirm >= STOP_CONFIRM_TICKS) {
        shouldClose = true;
        closeReason = trailingStop > position.entryPrice ? "Trailing stop" : "Stop-loss hit";
        // If trailing stop triggered, it's a WIN (locked in profit)
        outcome = trailingStop > position.entryPrice ? "WIN" : "LOSS";
      }
    } else {
      stopConfirm = 0;
    }
  } else {
    if (price <= position.target) {
      shouldClose = true;
      closeReason = "Take-profit hit";
      outcome = "WIN";
    } else if (price >= trailingStop) {
      stopConfirm += 1;
      if (stopConfirm >= STOP_CONFIRM_TICKS) {
        shouldClose = true;
        closeReason = trailingStop < position.entryPrice ? "Trailing stop" : "Stop-loss hit";
        outcome = trailingStop < position.entryPrice ? "WIN" : "LOSS";
      }
    } else {
      stopConfirm = 0;
    }
  }
  updated.stopConfirmTicks = stopConfirm;

  // Time-based exit — use per-strategy max hold (matches backtest)
  const stratParams = STRATEGY_PARAMS[position.strategy];
  const maxHoldMs = stratParams.maxHoldMs;
  if (!shouldClose && Date.now() - position.openedAt > maxHoldMs) {
    shouldClose = true;
    closeReason = "Time exit";
    outcome = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN";
  }
  return { position: updated, shouldClose, closeReason, pnl, pnlPct, outcome };
}

export function positionToTrade(
  position: Position,
  exitPrice: number,
  reason: string,
  outcome: "WIN" | "LOSS" | "BREAKEVEN",
): Trade {
  const dir = position.side === "LONG" ? 1 : -1;
  const pnl = (exitPrice - position.entryPrice) * position.size * dir;
  const pnlPct = (pnl / position.notional) * 100;
  return {
    id: nextId("trd"),
    pair: position.pair,
    side: position.side,
    strategy: position.strategy,
    entryPrice: position.entryPrice,
    exitPrice,
    size: position.size,
    notional: position.notional,
    pnl,
    pnlPct,
    openedAt: position.openedAt,
    closedAt: Date.now(),
    reason,
    outcome,
  };
}

// Pretty-format helpers used by the UI
export function fmtUsd(v: number, digits = 2): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(digits)}`;
}

export function fmtPrice(v: number): string {
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(3);
  if (v >= 0.01) return v.toFixed(4);
  return v.toFixed(6);
}

export function fmtPct(v: number, digits = 2): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Helper for chart-ready OHLC slices
export function sliceCandles(candles: Candle[], n: number): Candle[] {
  return candles.slice(Math.max(0, candles.length - n));
}
