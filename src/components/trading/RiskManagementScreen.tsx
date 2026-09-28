"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Calculator,
  Gauge,
  Layers,
  Percent,
  Shield,
  TrendingDown,
  Wallet,
  DollarSign,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTradingStore } from "@/lib/store/trading-store";
import { fmtUsd } from "@/lib/trading/engine";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  CollapsibleCard,
} from "@/components/trading/CollapsibleCard";

export function RiskManagementScreen() {
  const hydrated = useHydrated();
  const settings = useTradingStore((s) => s.settings);
  const updateSettings = useTradingStore((s) => s.updateSettings);
  const equity = useTradingStore((s) => s.startingBalance + s.realizedPnl);
  const positions = useTradingStore((s) => s.positions.length);
  const maxTotalPositions = settings.maxTotalPositions;
  const leverage = settings.leverage;

  // Calculate risk per trade in dollar terms
  const riskPerTradeDollar = equity * (settings.riskPerTradePct / 100);
  const maxDailyLossDollar = equity * (settings.riskPerTradePct / 100) * maxTotalPositions;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-red-300" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Risk Management
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mt-0.5">
              Capital Protection Controls
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Configure how much capital to risk per trade, maximum exposure,
              and daily loss limits. These settings apply to both simulation
              and live trading.
            </p>
          </div>
        </div>
      </div>

      {/* Current Account Summary */}
      <div className="glass rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryStat
            icon={<Wallet className="w-3.5 h-3.5" />}
            label="Account Equity"
            value={hydrated ? fmtUsd(equity) : "—"}
            accent="cyan"
          />
          <SummaryStat
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Open Positions"
            value={hydrated ? `${positions} / ${maxTotalPositions}` : "—"}
            accent="violet"
          />
          <SummaryStat
            icon={<Gauge className="w-3.5 h-3.5" />}
            label="Leverage"
            value={`${leverage}×`}
            accent="amber"
          />
          <SummaryStat
            icon={<DollarSign className="w-3.5 h-3.5" />}
            label="Risk Per Trade"
            value={hydrated ? fmtUsd(riskPerTradeDollar) : "—"}
            accent="red"
          />
        </div>
      </div>

      {/* Risk Per Trade */}
      <div className="glass rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Percent className="w-4 h-4 text-cyan-300" />
          <h3 className="font-bold text-sm">Per-Trade Risk</h3>
        </div>

        <div className="space-y-4">
          {/* Risk percentage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-muted-foreground">
                Risk per trade (% of equity)
              </Label>
              <span className="font-mono text-sm font-bold tabular-nums text-cyan-300">
                {settings.riskPerTradePct.toFixed(2)}%
              </span>
            </div>
            <Slider
              value={[settings.riskPerTradePct]}
              min={0.1}
              max={5}
              step={0.1}
              onValueChange={(v) => updateSettings({ riskPerTradePct: v[0] })}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
              <span>0.1% (conservative)</span>
              <span>1% (standard)</span>
              <span>5% (aggressive)</span>
            </div>
          </div>

          {/* Risk in dollar terms */}
          <div className="bg-white/[0.03] rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Dollar risk per trade
              </span>
            </div>
            <span className="font-mono text-lg font-bold tabular-nums text-red-300">
              {hydrated ? fmtUsd(riskPerTradeDollar) : "—"}
            </span>
          </div>

          {/* Fixed lot size override */}
          <FixedLotSizeControl />
        </div>
      </div>

      {/* Position Limits */}
      <CollapsibleCard
        icon={
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Layers className="w-4 h-4 text-violet-300" />
          </div>
        }
        title="Position Limits"
        subtitle="Max simultaneous open positions and leverage"
        defaultOpen={false}
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">
              Max positions per pair
            </Label>
            <span className="font-mono text-sm font-bold tabular-nums">
              {settings.maxPositionsPerPair}
            </span>
          </div>
          <Slider
            value={[settings.maxPositionsPerPair]}
            min={1}
            max={5}
            step={1}
            onValueChange={(v) => updateSettings({ maxPositionsPerPair: v[0] })}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">
              Max total open positions
            </Label>
            <span className="font-mono text-sm font-bold tabular-nums">
              {settings.maxTotalPositions}
            </span>
          </div>
          <Slider
            value={[settings.maxTotalPositions]}
            min={2}
            max={30}
            step={1}
            onValueChange={(v) => updateSettings({ maxTotalPositions: v[0] })}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">
              Leverage multiplier
            </Label>
            <span className="font-mono text-sm font-bold tabular-nums text-amber-300">
              {leverage}×
            </span>
          </div>
          <Slider
            value={[leverage]}
            min={1}
            max={20}
            step={1}
            onValueChange={(v) => updateSettings({ leverage: v[0] })}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
            <span>1× (no leverage)</span>
            <span>5× (moderate)</span>
            <span>20× (high risk)</span>
          </div>
        </div>
      </CollapsibleCard>

      {/* Stop Loss / Take Profit */}
      <CollapsibleCard
        icon={
          <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-red-300" />
          </div>
        }
        title="Stop Loss & Take Profit"
        subtitle="Per-trade risk:reward configuration"
        defaultOpen={false}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.03] rounded-lg p-3">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Stop Loss %
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={(settings.defaultStopPct * 100).toFixed(2)}
                onChange={(e) =>
                  updateSettings({ defaultStopPct: Number(e.target.value) / 100 })
                }
                className="font-mono text-sm bg-white/5 border-white/10"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Take Profit %
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={(settings.defaultTargetPct * 100).toFixed(2)}
                onChange={(e) =>
                  updateSettings({ defaultTargetPct: Number(e.target.value) / 100 })
                }
                className="font-mono text-sm bg-white/5 border-white/10"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        <div className="bg-white/[0.03] rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-emerald-300" />
            <span className="text-xs text-muted-foreground">
              Trailing stop (auto breakeven at +0.2%)
            </span>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px]">
            ACTIVE
          </Badge>
        </div>

        {/* Risk:Reward ratio display */}
        <div className="bg-white/[0.03] rounded-lg p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Risk : Reward ratio</span>
          <span className="font-mono text-sm font-bold tabular-nums text-cyan-300">
            1 : {(settings.defaultTargetPct / settings.defaultStopPct).toFixed(2)}
          </span>
        </div>
      </CollapsibleCard>

      {/* Daily Loss Limit */}
      <CollapsibleCard
        icon={
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
          </div>
        }
        title="Daily Loss Limit"
        subtitle="Auto-halt engine when cumulative daily loss is exceeded"
        accent="amber"
        defaultOpen={false}
      >
        <div className="bg-white/[0.03] rounded-lg p-3 flex items-center justify-between mb-1">
          <div>
            <div className="text-xs text-muted-foreground">Max daily loss (est.)</div>
            <div className="font-mono text-lg font-bold tabular-nums text-red-300 mt-0.5">
              {hydrated ? fmtUsd(maxDailyLossDollar) : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Based on {maxTotalPositions} max positions × {settings.riskPerTradePct.toFixed(1)}% risk
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch defaultChecked />
            <Label className="text-xs text-muted-foreground">
              Halt engine at limit
            </Label>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground leading-relaxed">
          When enabled, the engine will automatically stop trading if the
          cumulative daily loss exceeds the limit above. This protects your
          account from catastrophic drawdowns during unfavorable market
          conditions.
        </div>
      </CollapsibleCard>

      {/* Summary */}
      <div className="glass rounded-xl p-4 border border-cyan-500/20 bg-cyan-500/5">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-cyan-300" />
          <span className="font-semibold text-sm text-cyan-300">
            Risk Summary
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Risk/trade:</span>
            <span className="text-red-300">{hydrated ? fmtUsd(riskPerTradeDollar) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Max exposure:</span>
            <span className="text-amber-300">{hydrated ? fmtUsd(equity * leverage) : "—"} ({leverage}×)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Max daily loss:</span>
            <span className="text-red-300">{hydrated ? fmtUsd(maxDailyLossDollar) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">R:R ratio:</span>
            <span className="text-cyan-300">1:{(settings.defaultTargetPct / settings.defaultStopPct).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Fixed Lot Size Control ----------------

function FixedLotSizeControl() {
  const hydrated = useHydrated();
  const [enabled, setEnabled] = useState(false);
  const [lotSize, setLotSize] = useState("100");

  return (
    <div className="bg-white/[0.03] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground">
            Fixed lot size (overrides % risk)
          </Label>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      {enabled && (
        <div className="flex items-center gap-2 mt-2">
          <Input
            type="number"
            step="10"
            min="10"
            value={lotSize}
            onChange={(e) => setLotSize(e.target.value)}
            className="font-mono text-sm bg-white/5 border-white/10"
            placeholder="e.g. 100 USDT"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">USDT per trade</span>
        </div>
      )}
      {enabled && (
        <div className="text-[10px] text-muted-foreground mt-2">
          Each trade will use exactly {lotSize} USDT regardless of equity or
          risk percentage. Use this for precise position sizing on live accounts.
        </div>
      )}
    </div>
  );
}

// ---------------- Helpers ----------------

function SummaryStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "cyan" | "violet" | "amber" | "red";
}) {
  const colorMap = {
    cyan: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
    violet: "text-violet-300 bg-violet-500/10 border-violet-500/20",
    amber: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    red: "text-red-300 bg-red-500/10 border-red-500/20",
  };
  return (
    <div className="bg-white/[0.03] rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={cn(
            "w-5 h-5 rounded flex items-center justify-center border",
            colorMap[accent],
          )}
        >
          {icon}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="font-mono text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}
