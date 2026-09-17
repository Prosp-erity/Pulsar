"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, SlidersHorizontal, Lock } from "lucide-react";
import { useTradingStore } from "@/lib/store/trading-store";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function EngineSettingsPanel() {
  const [expanded, setExpanded] = useState(false);
  const settings = useTradingStore((s) => s.settings);
  const updateSettings = useTradingStore((s) => s.updateSettings);
  const setTickMs = useTradingStore((s) => s.setTickMs);
  const tickMs = useTradingStore((s) => s.tickMs);

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Sleek Chevron header button — click to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-4 hover:bg-white/[0.03] transition-colors group"
      >
        <SlidersHorizontal className="w-4 h-4 text-cyan-300 flex-shrink-0" />
        <div className="flex-1 text-left">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Engine Controls
          </div>
          <div className="font-semibold text-sm">Risk & Speed</div>
        </div>

        {/* Compact summary of current settings (always visible) */}
        {!expanded && (
          <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono tabular-nums text-muted-foreground">
            <span className="px-1.5 py-0.5 rounded bg-white/5">
              Risk {settings.riskPerTradePct.toFixed(1)}%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/5">
              Lev {settings.leverage}×
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/5">
              {settings.maxTotalPositions} pos
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/5">
              {(tickMs / 1000).toFixed(1)}s
            </span>
          </div>
        )}

        {/* Lock icon when collapsed — signals settings are protected */}
        {!expanded && (
          <div className="flex items-center gap-1 text-[9px] text-emerald-400/60">
            <Lock className="w-3 h-3" />
            <span className="hidden sm:inline">Locked</span>
          </div>
        )}

        {/* Chevron indicator */}
        <div
          className={cn(
            "transition-transform duration-300 text-muted-foreground group-hover:text-cyan-300",
            expanded ? "rotate-180" : "",
          )}
        >
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      {/* Expandable settings area — only visible when expanded */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          expanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
          {/* Warning banner */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-300/70">
            <Lock className="w-3 h-3 flex-shrink-0" />
            Settings are protected from scroll changes. Adjust carefully —
            changes take effect on the next trade.
          </div>

          <SliderControl
            label="Risk per trade"
            value={settings.riskPerTradePct}
            display={`${settings.riskPerTradePct.toFixed(1)}%`}
            min={0.25}
            max={3}
            step={0.25}
            onChange={(v) => updateSettings({ riskPerTradePct: v })}
          />

          <SliderControl
            label="Leverage"
            value={settings.leverage}
            display={`${settings.leverage}×`}
            min={1}
            max={20}
            step={1}
            onChange={(v) => updateSettings({ leverage: v })}
          />

          <SliderControl
            label="Max positions / pair"
            value={settings.maxPositionsPerPair}
            display={`${settings.maxPositionsPerPair}`}
            min={1}
            max={5}
            step={1}
            onChange={(v) => updateSettings({ maxPositionsPerPair: v })}
          />

          <SliderControl
            label="Max total positions"
            value={settings.maxTotalPositions}
            display={`${settings.maxTotalPositions}`}
            min={2}
            max={30}
            step={1}
            onChange={(v) => updateSettings({ maxTotalPositions: v })}
          />

          <SliderControl
            label="Take-profit"
            value={settings.defaultTargetPct * 100}
            display={`${(settings.defaultTargetPct * 100).toFixed(2)}%`}
            min={0.4}
            max={3}
            step={0.1}
            onChange={(v) => updateSettings({ defaultTargetPct: v / 100 })}
          />

          <SliderControl
            label="Stop-loss"
            value={settings.defaultStopPct * 100}
            display={`${(settings.defaultStopPct * 100).toFixed(2)}%`}
            min={0.2}
            max={2}
            step={0.1}
            onChange={(v) => updateSettings({ defaultStopPct: v / 100 })}
          />

          <SliderControl
            label="Tick speed"
            value={tickMs}
            display={`${(tickMs / 1000).toFixed(2)}s`}
            min={500}
            max={4000}
            step={250}
            onChange={(v) => setTickMs(v)}
          />

          {/* Collapse button at bottom */}
          <button
            onClick={() => setExpanded(false)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-muted-foreground hover:text-foreground transition"
          >
            <ChevronDown className="w-3.5 h-3.5 rotate-180" />
            Collapse & Lock
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Slider Control Component ----------------
// Wrapper that prevents scroll-wheel from changing the slider value.
// The slider only responds to explicit click-and-drag interaction.

function SliderControl({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div
      onWheel={(e) => {
        // Prevent scroll-wheel from changing slider values
        e.currentTarget.blur();
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <span className="font-mono text-xs font-semibold tabular-nums text-cyan-300">
          {display}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}
