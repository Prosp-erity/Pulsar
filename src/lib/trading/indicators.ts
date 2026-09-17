// Technical indicators used by the strategies.
// Pure functions, no side effects. All operate on arrays of numbers
// (typically close prices or candles) and return arrays aligned to the
// most-recent end of the input.

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    out.push(sum / period);
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    if (i === period - 1) {
      // seed with SMA
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[j];
      prev = sum / period;
      out.push(prev);
      continue;
    }
    prev = v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function rsi(values: number[], period: number): number[] {
  const out: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      out.push(NaN);
      continue;
    }
    const change = values[i] - values[i - 1];
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);
    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out.push(100 - 100 / (1 + rs));
      } else {
        out.push(NaN);
      }
      continue;
    }
    // Wilder's smoothing
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push(100 - 100 / (1 + rs));
  }
  return out;
}

export function stddev(values: number[], period: number): number[] {
  const out: number[] = [];
  const means = sma(values, period);
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    const mean = means[i];
    let acc = 0;
    for (let j = i - period + 1; j <= i; j++) {
      acc += (values[j] - mean) ** 2;
    }
    out.push(Math.sqrt(acc / period));
  }
  return out;
}

export interface BollingerBand {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function bollinger(
  values: number[],
  period: number,
  mult: number,
): BollingerBand {
  const middle = sma(values, period);
  const sd = stddev(values, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    upper.push(middle[i] + mult * sd[i]);
    lower.push(middle[i] - mult * sd[i]);
  }
  return { upper, middle, lower };
}

export function vwap(candles: { high: number; low: number; close: number; volume: number }[]): number {
  // Session VWAP — typical price * volume, summed, divided by total volume
  let pv = 0;
  let vol = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    pv += tp * c.volume;
    vol += c.volume;
  }
  return vol === 0 ? candles[candles.length - 1].close : pv / vol;
}

export function atr(
  candles: { high: number; low: number; close: number }[],
  period: number,
): number[] {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
      continue;
    }
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose),
    );
    trs.push(tr);
  }
  // Wilder smoothing
  const out: number[] = [];
  let prev = NaN;
  for (let i = 0; i < trs.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += trs[j];
      prev = sum / period;
      out.push(prev);
      continue;
    }
    prev = (prev * (period - 1) + trs[i]) / period;
    out.push(prev);
  }
  return out;
}

export function adx(candles: { high: number; low: number; close: number }[], period: number): number[] {
  // ADX using Wilder smoothing. Fixed: NaN-safe — computes DI/DX only
  // where smoothed TR is valid, then smooths the valid DX segment.
  const len = candles.length;
  const out: number[] = new Array(len).fill(NaN);
  if (len < 2 * period + 1) return out;

  const tr: number[] = new Array(len).fill(0);
  const plusDM: number[] = new Array(len).fill(0);
  const minusDM: number[] = new Array(len).fill(0);
  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < len; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
    tr[i] = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    );
  }

  const smoothedTR = wilderSmooth(tr, period);
  const smoothedPlusDM = wilderSmooth(plusDM, period);
  const smoothedMinusDM = wilderSmooth(minusDM, period);

  const dx: number[] = new Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    if (!isNaN(smoothedTR[i]) && smoothedTR[i] > 0) {
      const pDI = (100 * smoothedPlusDM[i]) / smoothedTR[i];
      const mDI = (100 * smoothedMinusDM[i]) / smoothedTR[i];
      const sum = pDI + mDI;
      dx[i] = sum === 0 ? 0 : (Math.abs(pDI - mDI) / sum) * 100;
    }
  }

  // Find first valid DX index, smooth the valid segment
  let firstValid = -1;
  for (let i = 0; i < len; i++) {
    if (!isNaN(dx[i])) {
      firstValid = i;
      break;
    }
  }
  if (firstValid === -1) return out;

  const validDx = dx.slice(firstValid);
  const smoothedDx = wilderSmooth(validDx, period);
  for (let i = 0; i < smoothedDx.length; i++) {
    if (!isNaN(smoothedDx[i])) {
      out[firstValid + i] = smoothedDx[i];
    }
  }
  return out;
}

function wilderSmooth(values: number[], period: number): number[] {
  const out: number[] = [];
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[j];
      prev = sum / period;
      out.push(prev);
      continue;
    }
    prev = (prev * (period - 1) + values[i]) / period;
    out.push(prev);
  }
  return out;
}

export function last(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return NaN;
}

export function rollingHigh(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    let m = -Infinity;
    for (let j = i - period + 1; j <= i; j++) m = Math.max(m, values[j]);
    out.push(m);
  }
  return out;
}

export function rollingLow(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    let m = Infinity;
    for (let j = i - period + 1; j <= i; j++) m = Math.min(m, values[j]);
    out.push(m);
  }
  return out;
}
