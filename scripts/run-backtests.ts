import { runStrategySummary } from "../src/lib/trading/backtest";
import { DEFAULT_PAIRS } from "../src/lib/trading/engine";

console.log("Running 3-month backtests (3 high-win-rate strategies, 5-min candles)...");
const t0 = Date.now();
const results = runStrategySummary(DEFAULT_PAIRS, {
  days: 90,
  candleMs: 5 * 60_000,
  initialCapital: 10_000,
});
const elapsed = Date.now() - t0;

console.log(`\n=== 3-Month Backtest Results (90 days, $10k start, ${elapsed}ms total) ===\n`);
for (const id of Object.keys(results) as (keyof typeof results)[]) {
  const r = results[id];
  const s = r.stats;
  const wrPass = s.winRate >= 70 ? "✓ PASS" : "✗ FAIL";
  console.log(
    `${r.strategyName.padEnd(26)} | ${r.symbol.padEnd(10)} | ` +
      `trades=${String(s.totalTrades).padStart(5)} ` +
      `WR=${s.winRate.toFixed(1).padStart(5)}% ${wrPass} ` +
      `PF=${s.profitFactor.toFixed(2).padStart(5)} ` +
      `Sharpe=${s.sharpe.toFixed(2).padStart(5)} ` +
      `MaxDD=${s.maxDrawdown.toFixed(1).padStart(5)}% ` +
      `Ret=${s.totalReturn.toFixed(1).padStart(6)}% ` +
      `(${r.durationMs.toFixed(0)}ms)`,
  );
}


