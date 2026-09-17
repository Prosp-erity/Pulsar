// Debug script — checks indicator values on generated candles

import { generateCandles, computeContext } from "../src/lib/trading/backtest";
import { DEFAULT_PAIRS } from "../src/lib/trading/engine";

const pair = DEFAULT_PAIRS[0]; // BTC
const candles = generateCandles(pair, 500, Date.now(), 60_000, 42);
const ctx = computeContext(candles);

let adxNonNan = 0;
let adxOver15 = 0;
let adxOver20 = 0;
let adxOver25 = 0;
let adxMax = 0;
let adxMin = 100;
for (let i = 0; i < ctx.adx14.length; i++) {
  const v = ctx.adx14[i];
  if (!isNaN(v)) {
    adxNonNan++;
    if (v > 15) adxOver15++;
    if (v > 20) adxOver20++;
    if (v > 25) adxOver25++;
    adxMax = Math.max(adxMax, v);
    adxMin = Math.min(adxMin, v);
  }
}

console.log(`ADX: nonNaN=${adxNonNan}/${ctx.adx14.length} >15=${adxOver15} >20=${adxOver20} >25=${adxOver25} min=${adxMin.toFixed(1)} max=${adxMax.toFixed(1)}`);

let atrNonNan = 0;
let atrAvg = 0;
let atrMax = 0;
for (let i = 0; i < ctx.atr14.length; i++) {
  const v = ctx.atr14[i];
  if (!isNaN(v)) {
    atrNonNan++;
    atrAvg += v;
    atrMax = Math.max(atrMax, v);
  }
}
console.log(`ATR: nonNaN=${atrNonNan} avg=${(atrAvg / atrNonNan).toFixed(2)} max=${atrMax.toFixed(2)}`);

let rsi2Min = 100, rsi2Max = 0;
let rsi2Below18 = 0, rsi2Above82 = 0;
for (let i = 0; i < ctx.rsi2.length; i++) {
  const v = ctx.rsi2[i];
  if (!isNaN(v)) {
    rsi2Min = Math.min(rsi2Min, v);
    rsi2Max = Math.max(rsi2Max, v);
    if (v < 18) rsi2Below18++;
    if (v > 82) rsi2Above82++;
  }
}
console.log(`RSI2: min=${rsi2Min.toFixed(1)} max=${rsi2Max.toFixed(1)} <18=${rsi2Below18} >82=${rsi2Above82}`);

let bbWidthAvg = 0;
let bbWidthCount = 0;
let bbAboveUpper = 0, bbBelowLower = 0;
for (let i = 0; i < ctx.candles.length; i++) {
  const u = ctx.bbUpper[i];
  const l = ctx.bbLower[i];
  const p = ctx.closes[i];
  if (!isNaN(u) && !isNaN(l) && p > 0) {
    const w = (u - l) / p;
    bbWidthAvg += w;
    bbWidthCount++;
    if (p > u) bbAboveUpper++;
    if (p < l) bbBelowLower++;
  }
}
console.log(`BB: avgWidth=${((bbWidthAvg / bbWidthCount) * 100).toFixed(3)}% aboveUpper=${bbAboveUpper} belowLower=${bbBelowLower}`);

// Count breakouts
let breakoutUp = 0, breakoutDown = 0;
for (let i = 1; i < ctx.candles.length; i++) {
  const rh = ctx.rollingHigh20[i - 1];
  const rl = ctx.rollingLow20[i - 1];
  const p = ctx.closes[i];
  const atr = ctx.atr14[i - 1];
  const adx = ctx.adx14[i - 1];
  if (!isNaN(rh) && !isNaN(atr) && !isNaN(adx) && adx > 15) {
    if (p > rh + atr * 0.1) breakoutUp++;
    if (p < rl - atr * 0.1) breakoutDown++;
  }
}
console.log(`Breakouts (ADX>15): up=${breakoutUp} down=${breakoutDown}`);

// Count EMA crosses
let emaCrossUp = 0, emaCrossDown = 0;
let emaCrossUpWithAdx = 0, emaCrossDownWithAdx = 0;
for (let i = 1; i < ctx.candles.length; i++) {
  const f = ctx.ema9[i];
  const s = ctx.ema21[i];
  const pf = ctx.ema9[i - 1];
  const ps = ctx.ema21[i - 1];
  const adx = ctx.adx14[i];
  if (isNaN(f) || isNaN(s) || isNaN(pf) || isNaN(ps)) continue;
  if (pf <= ps && f > s) {
    emaCrossUp++;
    if (!isNaN(adx) && adx > 20) emaCrossUpWithAdx++;
  }
  if (pf >= ps && f < s) {
    emaCrossDown++;
    if (!isNaN(adx) && adx > 20) emaCrossDownWithAdx++;
  }
}
console.log(`EMA Cross: up=${emaCrossUp} down=${emaCrossDown} upWithAdx20=${emaCrossUpWithAdx} downWithAdx20=${emaCrossDownWithAdx}`);
