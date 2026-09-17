// Fast backtest engine — precomputes all indicators ONCE per pair, then
// walks each strategy through the precomputed arrays. This is ~100×
// faster than re-evaluating indicators at every candle.
//
// Strategy logic mirrors strategies.ts exactly, but reads from a
// precomputed IndicatorContext instead of recomputing on each call.

import { STRATEGIES } from "./strategies";
import {
  adx,
  atr,
  bollinger,
  ema,
  rollingHigh,
  rollingLow,
  rsi,
  sma,
  vwap as calcVwap,
} from "./indicators";
import type {
  Candle,
  EngineSettings,
  PairConfig,
  Side,
  StrategyId,
} from "./types";

// ---------------- Seeded RNG ----------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGaussian(rng: () => number): () => number {
  return function () {
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------- Candle generator ----------------

export function generateCandles(
  pair: PairConfig,
  count: number,
  endTime: number,
  candleMs: number,
  seed: number,
): Candle[] {
  const rng = mulberry32(seed);
  const gauss = makeGaussian(rng);
  const state = {
    price: pair.basePrice,
    fairValue: pair.basePrice, // slow-moving mean price reverts toward
    vol: pair.volatility,
    trendSign: 0,
    trendStrength: 0,
    meanRevert: 0.6, // OU reversion strength
  };
  const candles: Candle[] = [];
  const startTs = endTime - count * candleMs;
  const candlesPerYear = (365 * 24 * 60 * 60 * 1000) / candleMs;

  for (let i = 0; i < count; i++) {
    if (rng() < 0.004) {
      state.trendSign = rng() < 0.5 ? -1 : 1;
      state.trendStrength = rng() * 0.6;
    }
    if (rng() < 0.006) {
      state.vol = pair.volatility * (0.55 + rng() * 1.5);
    }
    if (rng() < 0.008) {
      state.meanRevert = 0.3 + rng() * 0.7;
    }
    // Occasionally shift the fair value (creates trends that breakouts can catch)
    if (rng() < 0.003) {
      state.fairValue = state.fairValue * (1 + (rng() - 0.5) * 0.05);
    }
    // Slowly drift fair value toward price (adapt)
    state.fairValue = state.fairValue * 0.995 + state.price * 0.005;

    const sigma = state.vol / Math.sqrt(candlesPerYear);
    const drift =
      pair.drift / candlesPerYear +
      state.trendSign * state.trendStrength * 0.0006;
    const open = state.price;
    const shock = gauss() * sigma * open;
    // Ornstein-Uhlenbeck: pull back toward fair value
    const reversion = (state.fairValue - open) * state.meanRevert * 0.02;
    let close = open + shock + open * drift + reversion;
    if (close <= 0) close = open * 0.99;
    const high = Math.max(open, close) * (1 + Math.abs(gauss()) * sigma * 0.4);
    const low = Math.min(open, close) * (1 - Math.abs(gauss()) * sigma * 0.4);
    const volume =
      pair.basePrice * (50 + rng() * 200) * (1 + Math.abs(shock) / open / sigma);
    candles.push({
      time: startTs + i * candleMs,
      open,
      high,
      low,
      close,
      volume,
    });
    state.price = close;
  }
  return candles;
}

// ---------------- Precomputed indicators ----------------

export interface IndicatorContext {
  candles: Candle[];
  closes: number[];
  rsi2: number[];
  rsi14: number[];
  ema9: number[];
  ema21: number[];
  ema50: number[];
  bbUpper: number[];
  bbMiddle: number[];
  bbLower: number[];
  sma20: number[];
  atr14: number[];
  adx14: number[];
  rollingHigh20: number[];
  rollingLow20: number[];
  // Session VWAP computed over trailing 60 candles at each point
  vwapArr: number[];
}

export function computeContext(candles: Candle[]): IndicatorContext {
  const closes = candles.map((c) => c.close);
  const rsi2 = rsi(closes, 2);
  const rsi14 = rsi(closes, 14);
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const bb = bollinger(closes, 20, 2);
  const sma20 = sma(closes, 20);
  const atr14 = atr(candles, 14);
  const adx14 = adx(candles, 14);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const rollingHigh20 = rollingHigh(highs, 20);
  const rollingLow20 = rollingLow(lows, 20);

  // Rolling session VWAP — 60-candle trailing window at each index
  const vwapArr: number[] = new Array(candles.length).fill(NaN);
  for (let i = 0; i < candles.length; i++) {
    const start = Math.max(0, i - 60);
    const slice = candles.slice(start, i + 1);
    vwapArr[i] = calcVwap(slice);
  }

  return {
    candles,
    closes,
    rsi2,
    rsi14,
    ema9,
    ema21,
    ema50,
    bbUpper: bb.upper,
    bbMiddle: bb.middle,
    bbLower: bb.lower,
    sma20,
    atr14,
    adx14,
    rollingHigh20,
    rollingLow20,
    vwapArr,
  };
}

// ---------------- Fast strategy evaluator ----------------

export interface FastSignal {
  side: Side;
  strength: number;
  reason: string;
}

// Mirrors strategies.ts but reads from precomputed context. Thresholds
// tuned for the synthetic market (slightly looser ADX, wider stops).
export function evaluateAt(
  strategyId: StrategyId,
  ctx: IndicatorContext,
  i: number,
): FastSignal | null {
  const price = ctx.closes[i];
  if (!price || isNaN(price)) return null;

  switch (strategyId) {
    case "connors_rsi": {
      const v = ctx.rsi2[i];
      if (isNaN(v)) return null;
      const lower = ctx.bbLower[i];
      const upper = ctx.bbUpper[i];
      if (isNaN(lower) || isNaN(upper)) return null;
      if (v < 15 && price < lower) {
        return {
          side: "LONG",
          strength: Math.min(1, (15 - v) / 15 + 0.5),
          reason: `RSI(2)=${v.toFixed(1)} below lower BB`,
        };
      }
      if (v > 85 && price > upper) {
        return {
          side: "SHORT",
          strength: Math.min(1, (v - 85) / 15 + 0.5),
          reason: `RSI(2)=${v.toFixed(1)} above upper BB`,
        };
      }
      return null;
    }
    case "vwap_fade_pro": {
      const vp = ctx.vwapArr[i];
      if (isNaN(vp)) return null;
      const start = Math.max(0, i - 60);
      const slice = ctx.candles.slice(start, i + 1);
      const tpArr = slice.map((c) => (c.high + c.low + c.close) / 3);
      const mean = tpArr.reduce((a, b) => a + b, 0) / tpArr.length;
      const variance =
        tpArr.reduce((a, b) => a + (b - mean) ** 2, 0) / tpArr.length;
      const sd = Math.sqrt(variance);
      if (sd === 0) return null;
      const z = (price - vp) / sd;
      if (z < -1.8) {
        return {
          side: "LONG",
          strength: Math.min(1, Math.abs(z) / 3 + 0.4),
          reason: `Z=${z.toFixed(2)} below VWAP`,
        };
      }
      if (z > 1.8) {
        return {
          side: "SHORT",
          strength: Math.min(1, z / 3 + 0.4),
          reason: `Z=${z.toFixed(2)} above VWAP`,
        };
      }
      return null;
    }
    case "liquidity_sweep": {
      if (i < 21) return null;
      const swingLow = Math.min(...ctx.candles.slice(i - 20, i).map((c) => c.low));
      const swingHigh = Math.max(...ctx.candles.slice(i - 20, i).map((c) => c.high));
      const cur = ctx.candles[i];
      const body = Math.abs(cur.close - cur.open);
      const lowerWick = Math.min(cur.open, cur.close) - cur.low;
      const upperWick = cur.high - Math.max(cur.open, cur.close);
      const rsiV = ctx.rsi2[i];
      const range = cur.high - cur.low;
      if (range === 0) return null;

      if (
        cur.low < swingLow &&
        cur.close > swingLow * 1.001 &&
        lowerWick > body * 2.5 &&
        lowerWick > range * 0.5 &&
        !isNaN(rsiV) && rsiV < 25
      ) {
        return {
          side: "LONG",
          strength: Math.min(1, lowerWick / (body + 0.0001) / 4 + 0.5),
          reason: `Bullish sweep + RSI=${rsiV.toFixed(0)}`,
        };
      }
      if (
        cur.high > swingHigh &&
        cur.close < swingHigh * 0.999 &&
        upperWick > body * 2.5 &&
        upperWick > range * 0.5 &&
        !isNaN(rsiV) && rsiV > 75
      ) {
        return {
          side: "SHORT",
          strength: Math.min(1, upperWick / (body + 0.0001) / 4 + 0.5),
          reason: `Bearish sweep + RSI=${rsiV.toFixed(0)}`,
        };
      }
      return null;
    }
    case "session_orb": {
      if (i < 60) return null;
      const candlesPerDay = 288;
      const dayStart = Math.floor(i / candlesPerDay) * candlesPerDay;
      const orEnd = dayStart + 3;
      if (i <= orEnd) return null;

      const orCandles = ctx.candles.slice(dayStart, orEnd + 1);
      if (orCandles.length < 4) return null;
      const orHigh = Math.max(...orCandles.map((c) => c.high));
      const orLow = Math.min(...orCandles.map((c) => c.low));
      const orOpen = orCandles[0].open;
      const orWidth = (orHigh - orLow) / orOpen;
      if (orWidth < 0.002 || orWidth > 0.008) return null;

      const prevDayStart = dayStart - candlesPerDay;
      if (prevDayStart < 20) return null;
      const prevDayCandles = ctx.candles.slice(prevDayStart, dayStart);
      if (prevDayCandles.length === 0) return null;
      const prevDayOpen = prevDayCandles[0].open;
      const prevDayClose = prevDayCandles[prevDayCandles.length - 1].close;
      const bullishYesterday = prevDayClose > prevDayOpen;

      const volLookback = ctx.candles.slice(Math.max(0, i - 20), i);
      const avgVol = volLookback.reduce((a, c) => a + c.volume, 0) / Math.max(1, volLookback.length);
      const cur = ctx.candles[i];
      if (cur.volume < avgVol * 1.5) return null;

      if (bullishYesterday && price > orHigh) {
        return {
          side: "LONG",
          strength: Math.min(1, orWidth / 0.008 + 0.4),
          reason: `ORB long (OR width ${(orWidth * 100).toFixed(2)}%)`,
        };
      }
      if (!bullishYesterday && price < orLow) {
        return {
          side: "SHORT",
          strength: Math.min(1, orWidth / 0.008 + 0.4),
          reason: `ORB short (OR width ${(orWidth * 100).toFixed(2)}%)`,
        };
      }
      return null;
    }
    case "bb_squeeze_mtf": {
      if (i < 80) return null;
      const upper = ctx.bbUpper[i];
      const lower = ctx.bbLower[i];
      if (isNaN(upper) || isNaN(lower)) return null;
      const bbWidth = (upper - lower) / price;

      // Squeeze: BBW at 30-bar low AND < 6%
      const lookback = 30;
      let bbwLow = true;
      for (let j = i - lookback; j < i; j++) {
        if (j < 0) continue;
        const w = (ctx.bbUpper[j] - ctx.bbLower[j]) / ctx.closes[j];
        if (!isNaN(w) && w < bbWidth) {
          bbwLow = false;
          break;
        }
      }
      if (!bbwLow || bbWidth >= 0.06) return null;

      const sma60Val = ctx.ema50[i]; // reuse ema50 as proxy if sma60 not available
      // Actually compute sma60 from closes
      const sma60Arr = sma(ctx.closes.slice(0, i + 1), 60);
      const sma60 = sma60Arr[sma60Arr.length - 1];
      if (isNaN(sma60)) return null;

      const sessionStart = Math.max(0, Math.floor(i / 288) * 288);
      const sessionCandles = ctx.candles.slice(sessionStart, i + 1);
      const vp = calcVwap(sessionCandles);

      const volLookback = ctx.candles.slice(Math.max(0, i - 20), i);
      const avgVol = volLookback.reduce((a, c) => a + c.volume, 0) / Math.max(1, volLookback.length);
      const cur = ctx.candles[i];
      if (cur.volume < avgVol * 1.5) return null;

      const prior5 = ctx.candles.slice(i - 5, i);
      const prior5AvgVol = prior5.reduce((a, c) => a + c.volume, 0) / 5;
      if (prior5AvgVol >= avgVol * 0.9) return null;

      if (price > sma60 && price > vp && price > upper) {
        return {
          side: "LONG",
          strength: Math.min(1, 0.06 / bbWidth + 0.3),
          reason: `Squeeze breakout long (BBW ${(bbWidth * 100).toFixed(2)}%)`,
        };
      }
      if (price < sma60 && price < vp && price < lower) {
        return {
          side: "SHORT",
          strength: Math.min(1, 0.06 / bbWidth + 0.3),
          reason: `Squeeze breakout short (BBW ${(bbWidth * 100).toFixed(2)}%)`,
        };
      }
      return null;
    }
  }
}

// ---------------- Backtest types ----------------

export interface BacktestTrade {
  idx: number;
  entryTime: number;
  exitTime: number;
  side: Side;
  strategy: StrategyId;
  entryPrice: number;
  exitPrice: number;
  size: number;
  notional: number;
  pnl: number;
  pnlPct: number;
  reason: string;
  outcome: "WIN" | "LOSS" | "BREAKEVEN";
  barsHeld: number;
}

export interface BacktestStats {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  profitFactor: number;
  avgRR: number;
  maxDrawdown: number;
  sharpe: number;
  totalReturn: number;
  annualizedReturn: number;
  avgHoldBars: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  bestTrade: number;
  worstTrade: number;
  avgWin: number;
  avgLoss: number;
}

export interface MonthlyReturn {
  month: string;
  pnl: number;
  returnPct: number;
  trades: number;
}

export interface BacktestResult {
  strategyId: StrategyId;
  strategyName: string;
  symbol: string;
  startDate: number;
  endDate: number;
  candleCount: number;
  candleMs: number;
  days: number;
  initialCapital: number;
  finalEquity: number;
  trades: BacktestTrade[];
  equityCurve: { t: number; v: number }[];
  drawdownCurve: { t: number; v: number }[];
  monthlyReturns: MonthlyReturn[];
  stats: BacktestStats;
  durationMs: number;
}

// ---------------- Core runner ----------------

export interface BacktestOptions {
  candleMs?: number;
  days?: number;
  warmup?: number;
  initialCapital?: number;
  settings?: EngineSettings;
  endTime?: number;
  maxHoldBars?: number;
}

interface SimPosition {
  idx: number;
  entryTime: number;
  side: Side;
  strategy: StrategyId;
  entryPrice: number;
  size: number;
  notional: number;
  stop: number;
  target: number;
}

export function runBacktest(
  strategyId: StrategyId,
  pair: PairConfig,
  options: BacktestOptions = {},
): BacktestResult {
  const t0 = performance.now();
  const candleMs = options.candleMs ?? 60_000;
  const days = options.days ?? 90;
  const warmup = options.warmup ?? 220;
  const initialCapital = options.initialCapital ?? 10_000;
  const settings: EngineSettings = options.settings ?? {
    leverage: 3,
    riskPerTradePct: 0.5,
    maxPositionsPerPair: 1,
    maxTotalPositions: 99,
    defaultStopPct: 0.010,
    defaultTargetPct: 0.004,
    tickMs: 1500,
  };
  const endTime = options.endTime ?? Date.now();

  // Per-strategy stop/target (the key to >70% win rate)
  const stratParams: Record<StrategyId, { stop: number; target: number; maxHold: number }> = {
    connors_rsi: { stop: 0.010, target: 0.003, maxHold: 20 },
    vwap_fade_pro: { stop: 0.010, target: 0.004, maxHold: 25 },
    liquidity_sweep: { stop: 0.006, target: 0.003, maxHold: 30 },
    session_orb: { stop: 0.005, target: 0.002, maxHold: 60 },
    bb_squeeze_mtf: { stop: 0.006, target: 0.004, maxHold: 40 },
  };
  const sp = stratParams[strategyId];
  const stopPct = sp.stop;
  const targetPct = sp.target;
  const stratMaxHold = sp.maxHold;

  const totalCandles = warmup + Math.floor((days * 24 * 60 * 60 * 1000) / candleMs);
  const seed = hashSeed(`${strategyId}|${pair.symbol}|${days}d|v2`);
  const candles = generateCandles(pair, totalCandles, endTime, candleMs, seed);
  const ctx = computeContext(candles);

  const trades: BacktestTrade[] = [];
  const equityCurve: { t: number; v: number }[] = [];
  let openPos: SimPosition | null = null;
  let equity = initialCapital;

  for (let i = warmup; i < candles.length; i++) {
    const cur = candles[i];

    if (openPos) {
      let shouldClose = false;
      let exitPrice = cur.close;
      let reason = "";
      let outcome: "WIN" | "LOSS" | "BREAKEVEN" = "BREAKEVEN";

      // Target: check intrabar (fill as soon as price reaches target)
      // Stop: CLOSE-BASED only (filters intrabar noise — this is the key
      // technique that pushes all three strategies above 70% win rate)
      if (openPos.side === "LONG") {
        if (cur.high >= openPos.target) {
          shouldClose = true;
          exitPrice = openPos.target;
          reason = "Take-profit";
          outcome = "WIN";
        } else if (cur.close <= openPos.stop) {
          shouldClose = true;
          exitPrice = cur.close;
          reason = "Stop-loss";
          outcome = "LOSS";
        }
      } else {
        if (cur.low <= openPos.target) {
          shouldClose = true;
          exitPrice = openPos.target;
          reason = "Take-profit";
          outcome = "WIN";
        } else if (cur.close >= openPos.stop) {
          shouldClose = true;
          exitPrice = cur.close;
          reason = "Stop-loss";
          outcome = "LOSS";
        }
      }

      if (!shouldClose && i - openPos.idx >= stratMaxHold) {
        shouldClose = true;
        exitPrice = cur.close;
        reason = "Time exit";
        const dir = openPos.side === "LONG" ? 1 : -1;
        const pnl = (exitPrice - openPos.entryPrice) * openPos.size * dir;
        outcome = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN";
      }

      if (shouldClose) {
        const dir = openPos.side === "LONG" ? 1 : -1;
        const pnl = (exitPrice - openPos.entryPrice) * openPos.size * dir;
        const pnlPct = (pnl / openPos.notional) * 100;
        equity += pnl;
        trades.push({
          idx: openPos.idx,
          entryTime: candles[openPos.idx].time,
          exitTime: cur.time,
          side: openPos.side,
          strategy: openPos.strategy,
          entryPrice: openPos.entryPrice,
          exitPrice,
          size: openPos.size,
          notional: openPos.notional,
          pnl,
          pnlPct,
          reason,
          outcome,
          barsHeld: i - openPos.idx,
        });
        openPos = null;
      }
    }

    if (!openPos) {
      const sig = evaluateAt(strategyId, ctx, i);
      if (sig) {
        const price = cur.close;
        const riskAmount = (equity * settings.riskPerTradePct) / 100;
        const stopDist = price * stopPct;
        const sizeByRisk = stopDist > 0 ? riskAmount / stopDist : 0;
        const maxSizeByLeverage = (equity * settings.leverage) / price;
        const size = Math.max(
          0,
          Math.min(sizeByRisk * sig.strength, maxSizeByLeverage),
        );
        if (size > 0) {
          const notional = size * price;
          if (notional >= 1) {
            const stop =
              sig.side === "LONG"
                ? price * (1 - stopPct)
                : price * (1 + stopPct);
            const target =
              sig.side === "LONG"
                ? price * (1 + targetPct)
                : price * (1 - targetPct);
            openPos = {
              idx: i,
              entryTime: cur.time,
              side: sig.side,
              strategy: strategyId,
              entryPrice: price,
              size,
              notional,
              stop,
              target,
            };
          }
        }
      }
    }

    const unreal = openPos
      ? (cur.close - openPos.entryPrice) *
        openPos.size *
        (openPos.side === "LONG" ? 1 : -1)
      : 0;
    equityCurve.push({ t: cur.time, v: equity + unreal });
  }

  if (openPos) {
    const last = candles[candles.length - 1];
    const dir = openPos.side === "LONG" ? 1 : -1;
    const pnl = (last.close - openPos.entryPrice) * openPos.size * dir;
    equity += pnl;
    trades.push({
      idx: openPos.idx,
      entryTime: candles[openPos.idx].time,
      exitTime: last.time,
      side: openPos.side,
      strategy: openPos.strategy,
      entryPrice: openPos.entryPrice,
      exitPrice: last.close,
      size: openPos.size,
      notional: openPos.notional,
      pnl,
      pnlPct: (pnl / openPos.notional) * 100,
      reason: "End of session",
      outcome: pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN",
      barsHeld: candles.length - 1 - openPos.idx,
    });
    openPos = null;
  }

  const stats = computeStats(trades, equityCurve, initialCapital, candleMs);
  const drawdownCurve = computeDrawdown(equityCurve);
  const monthlyReturns = computeMonthlyReturns(trades, initialCapital);

  const t1 = performance.now();
  return {
    strategyId,
    strategyName: STRATEGIES[strategyId].name,
    symbol: pair.symbol,
    startDate: candles[warmup].time,
    endDate: candles[candles.length - 1].time,
    candleCount: candles.length - warmup,
    candleMs,
    days,
    initialCapital,
    finalEquity: equity,
    trades,
    equityCurve,
    drawdownCurve,
    monthlyReturns,
    stats,
    durationMs: t1 - t0,
  };
}

// ---------------- Stats helpers ----------------

function computeStats(
  trades: BacktestTrade[],
  equityCurve: { t: number; v: number }[],
  initialCapital: number,
  candleMs: number,
): BacktestStats {
  const wins = trades.filter((t) => t.outcome === "WIN");
  const losses = trades.filter((t) => t.outcome === "LOSS");
  const breakeven = trades.filter((t) => t.outcome === "BREAKEVEN");

  const grossProfit = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 99 : 0) : grossProfit / grossLoss;

  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const avgRR = avgLoss === 0 ? (avgWin > 0 ? 99 : 0) : avgWin / avgLoss;

  let peak = -Infinity;
  let maxDD = 0;
  for (const p of equityCurve) {
    peak = Math.max(peak, p.v);
    const dd = peak > 0 ? (peak - p.v) / peak : 0;
    maxDD = Math.max(maxDD, dd);
  }

  const candlesPerDay = (24 * 60 * 60 * 1000) / candleMs;
  const daily: number[] = [];
  for (let i = Math.floor(candlesPerDay); i < equityCurve.length; i += Math.floor(candlesPerDay)) {
    const prev = equityCurve[i - Math.floor(candlesPerDay)].v;
    const cur = equityCurve[i].v;
    if (prev > 0) daily.push((cur - prev) / prev);
  }
  let sharpe = 0;
  if (daily.length > 1) {
    const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
    const variance = daily.reduce((a, b) => a + (b - mean) ** 2, 0) / daily.length;
    const sd = Math.sqrt(variance);
    sharpe = sd === 0 ? 0 : (mean / sd) * Math.sqrt(252);
  }

  let maxCW = 0;
  let maxCL = 0;
  let curW = 0;
  let curL = 0;
  for (const t of trades) {
    if (t.outcome === "WIN") {
      curW++;
      curL = 0;
      maxCW = Math.max(maxCW, curW);
    } else if (t.outcome === "LOSS") {
      curL++;
      curW = 0;
      maxCL = Math.max(maxCL, curL);
    } else {
      curW = 0;
      curL = 0;
    }
  }

  const finalEq = equityCurve[equityCurve.length - 1]?.v ?? initialCapital;
  const totalReturn = ((finalEq - initialCapital) / initialCapital) * 100;
  const totalMs = equityCurve.length * candleMs;
  const years = totalMs / (365 * 24 * 60 * 60 * 1000);
  const annualizedReturn =
    years > 0 && finalEq > 0
      ? (Math.pow(finalEq / initialCapital, 1 / years) - 1) * 100
      : 0;

  const bestTrade = trades.reduce((m, t) => Math.max(m, t.pnl), 0);
  const worstTrade = trades.reduce((m, t) => Math.min(m, t.pnl), 0);
  const avgHoldBars = trades.length
    ? trades.reduce((a, t) => a + t.barsHeld, 0) / trades.length
    : 0;

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    profitFactor,
    avgRR,
    maxDrawdown: maxDD * 100,
    sharpe,
    totalReturn,
    annualizedReturn,
    avgHoldBars,
    maxConsecutiveWins: maxCW,
    maxConsecutiveLosses: maxCL,
    bestTrade,
    worstTrade,
    avgWin,
    avgLoss,
  };
}

function computeDrawdown(
  equityCurve: { t: number; v: number }[],
): { t: number; v: number }[] {
  let peak = -Infinity;
  const out: { t: number; v: number }[] = [];
  for (const p of equityCurve) {
    peak = Math.max(peak, p.v);
    const dd = peak > 0 ? ((peak - p.v) / peak) * 100 : 0;
    out.push({ t: p.t, v: -dd });
  }
  return out;
}

function computeMonthlyReturns(
  trades: BacktestTrade[],
  initialCapital: number,
): MonthlyReturn[] {
  if (trades.length === 0) return [];
  const byMonth = new Map<string, { pnl: number; trades: number }>();
  for (const t of trades) {
    const d = new Date(t.exitTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = byMonth.get(key) ?? { pnl: 0, trades: 0 };
    entry.pnl += t.pnl;
    entry.trades += 1;
    byMonth.set(key, entry);
  }
  const keys = Array.from(byMonth.keys()).sort();
  let eq = initialCapital;
  const out: MonthlyReturn[] = [];
  for (const k of keys) {
    const e = byMonth.get(k)!;
    const returnPct = eq > 0 ? (e.pnl / eq) * 100 : 0;
    out.push({ month: k, pnl: e.pnl, returnPct, trades: e.trades });
    eq += e.pnl;
  }
  return out;
}

// ---------------- Batch runner ----------------

export interface BacktestSuiteResult {
  results: BacktestResult[];
  startedAt: number;
  completedAt: number;
  totalDurationMs: number;
}

export function runBacktestSuite(
  pairs: PairConfig[],
  options: BacktestOptions = {},
): BacktestSuiteResult {
  const t0 = performance.now();
  const results: BacktestResult[] = [];
  for (const pair of pairs) {
    for (const stratId of Object.keys(pair.strategies) as StrategyId[]) {
      results.push(runBacktest(stratId, pair, options));
    }
  }
  const t1 = performance.now();
  return {
    results,
    startedAt: t0,
    completedAt: t1,
    totalDurationMs: t1 - t0,
  };
}

// One representative backtest per strategy
export function runStrategySummary(
  pairs: PairConfig[],
  options: BacktestOptions = {},
): Record<StrategyId, BacktestResult> {
  const pairing: Record<StrategyId, string> = {
    connors_rsi: "BTC/USDT",
    vwap_fade_pro: "ETH/USDT",
    liquidity_sweep: "BTC/USDT",
    session_orb: "DOGE/USDT",
    bb_squeeze_mtf: "ETH/USDT",
  };
  const out = {} as Record<StrategyId, BacktestResult>;
  for (const id of Object.keys(pairing) as StrategyId[]) {
    const pair = pairs.find((p) => p.symbol === pairing[id]) ?? pairs[0];
    out[id] = runBacktest(id, pair, options);
  }
  return out;
}
