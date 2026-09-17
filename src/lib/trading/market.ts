// Market simulator — generates realistic crypto-like price action
// using a geometric brownian motion with stochastic volatility and
// occasional momentum bursts (regime switches). Designed to give the
// strategies enough structure that mean-reversion and breakout logic
// both have edges to exploit.

import type { Candle, PairConfig } from "./types";

interface PairState {
  price: number;
  history: Candle[];
  recentCloses: number[];
  vol: number; // current instantaneous vol (scaled by config)
  trendSign: number; // -1..1, current trend bias
  trendStrength: number; // 0..1
  tickCount: number;
}

const CANDLE_TICKS = 20; // accumulate 20 ticks into 1 candle (~30s candle @ 1.5s tick)

const stateBySymbol = new Map<string, PairState>();

function getState(pair: PairConfig): PairState {
  let s = stateBySymbol.get(pair.symbol);
  if (!s) {
    s = {
      price: pair.basePrice,
      history: [],
      recentCloses: [],
      vol: pair.volatility,
      trendSign: 0,
      trendStrength: 0,
      tickCount: 0,
    };
    // Seed with 200 candles of history so indicators are warm
    seedHistory(s, pair);
    stateBySymbol.set(pair.symbol, s);
  }
  return s;
}

function seedHistory(state: PairState, pair: PairConfig) {
  const now = Date.now();
  const candleMs = CANDLE_TICKS * 1000;
  // Need enough ticks to produce 220+ actual candles
  const n = 220 * CANDLE_TICKS;
  for (let i = n; i > 0; i--) {
    advance(state, pair, now - i * (candleMs / CANDLE_TICKS));
  }
}

function advance(state: PairState, pair: PairConfig, ts: number) {
  // Occasional regime switch
  if (Math.random() < 0.04) {
    state.trendSign = Math.random() < 0.5 ? -1 : 1;
    state.trendStrength = Math.random() * 0.7;
  }
  if (Math.random() < 0.05) {
    // volatility regime shift
    state.vol = pair.volatility * (0.6 + Math.random() * 1.4);
  }

  const tickVol = state.vol / Math.sqrt(252 * 24 * 3600 / CANDLE_TICKS); // per-tick sigma
  const driftPerTick =
    pair.drift / (252 * 24 * 3600 / CANDLE_TICKS) +
    state.trendSign * state.trendStrength * 0.0008;
  const shock = gaussian() * tickVol * state.price;
  const open = state.price;
  let close = open * (1 + driftPerTick) + shock;
  if (close <= 0) close = open * 0.99;
  const high = Math.max(open, close) * (1 + Math.abs(gaussian()) * tickVol * 0.5);
  const low = Math.min(open, close) * (1 - Math.abs(gaussian()) * tickVol * 0.5);
  const volume = pair.basePrice * (50 + Math.random() * 200) * (1 + Math.abs(shock) / open / tickVol);
  state.price = close;
  state.recentCloses.push(close);
  if (state.recentCloses.length > 600) state.recentCloses.shift();

  // Bucket ticks into candles
  if (state.tickCount % CANDLE_TICKS === 0) {
    state.history.push({
      time: ts,
      open,
      high,
      low,
      close,
      volume,
    });
    if (state.history.length > 600) state.history.shift();
  } else {
    const last = state.history[state.history.length - 1];
    if (last) {
      last.close = close;
      last.high = Math.max(last.high, high);
      last.low = Math.min(last.low, low);
      last.volume += volume;
      last.time = ts;
    }
  }
  state.tickCount++;
}

// Box-Muller transform
function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function tickPair(pair: PairConfig): { price: number; candle?: Candle } {
  const state = getState(pair);
  const before = state.history.length;
  advance(state, pair, Date.now());
  const candle = state.history.length > before ? state.history[state.history.length - 1] : undefined;
  return { price: state.price, candle };
}

export function getCandles(symbol: string, n: number): Candle[] {
  const s = stateBySymbol.get(symbol);
  if (!s) return [];
  return s.history.slice(Math.max(0, s.history.length - n));
}

export function getRecentCloses(symbol: string, n: number): number[] {
  const s = stateBySymbol.get(symbol);
  if (!s) return [];
  return s.recentCloses.slice(Math.max(0, s.recentCloses.length - n));
}

export function getCurrentPrice(symbol: string): number {
  const s = stateBySymbol.get(symbol);
  return s ? s.price : 0;
}

export function resetMarket() {
  stateBySymbol.clear();
}
