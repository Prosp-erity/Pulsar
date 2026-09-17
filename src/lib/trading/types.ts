// Core domain types for the crypto scalping engine

export type Side = "LONG" | "SHORT";

export type StrategyId =
  | "connors_rsi"
  | "vwap_fade_pro"
  | "liquidity_sweep"
  | "session_orb"
  | "bb_squeeze_mtf";

export interface Candle {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PairConfig {
  symbol: string; // e.g. "BTC/USDT"
  basePrice: number;
  volatility: number; // annualized vol, used by the simulator
  drift: number; // tiny trend bias
  enabled: boolean;
  strategies: Record<StrategyId, boolean>;
}

export interface Signal {
  strategy: StrategyId;
  pair: string;
  side: Side;
  strength: number; // 0..1, drives position sizing
  reason: string;
  ts: number;
}

export interface Position {
  id: string;
  pair: string;
  side: Side;
  strategy: StrategyId;
  entryPrice: number;
  size: number; // in base currency units
  notional: number; // = entryPrice * size (quote currency)
  stop: number;
  target: number;
  openedAt: number;
  unrealizedPnl: number;
  status: "OPEN" | "CLOSED";
  stopConfirmTicks?: number; // consecutive ticks price has been past stop (for close-based stops)
}

export interface Trade {
  id: string;
  pair: string;
  side: Side;
  strategy: StrategyId;
  entryPrice: number;
  exitPrice: number;
  size: number;
  notional: number;
  pnl: number; // quote currency
  pnlPct: number; // percent of notional
  openedAt: number;
  closedAt: number;
  reason: string; // why we closed
  outcome: "WIN" | "LOSS" | "BREAKEVEN";
}

export interface StrategyStats {
  id: StrategyId;
  name: string;
  tagline: string;
  description: string;
  bestFor: string;
  // Backtested (verified) headline numbers
  backtest: {
    winRate: number; // %
    profitFactor: number;
    avgRR: number; // reward:risk
    maxDrawdown: number; // %
    sharpe: number;
    trades: number; // sample size
    period: string;
    timeframe: string;
    annualizedReturn: number; // %
  };
  color: string; // accent for charts / chips
  livePnl: number;
  liveTrades: number;
  liveWins: number;
}

export interface AccountSnapshot {
  startingBalance: number;
  equity: number;
  balance: number;
  unrealizedPnl: number;
  realizedPnl: number;
  marginUsed: number;
  openPositions: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  equityCurve: { t: number; v: number }[];
}

export interface EngineSettings {
  leverage: number;
  riskPerTradePct: number; // % of equity risked per trade
  maxPositionsPerPair: number;
  maxTotalPositions: number;
  defaultStopPct: number; // 0.008 = 0.8%
  defaultTargetPct: number; // 0.012 = 1.2%
  tickMs: number;
}
