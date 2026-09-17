"use client";

import { useTradingStore } from "@/lib/store/trading-store";
import { fmtPrice, fmtPct } from "@/lib/trading/engine";

export function PriceTicker() {
  const pairs = useTradingStore((s) => s.pairs);
  const prices = useTradingStore((s) => s.prices);
  const prevPrices = useTradingStore((s) => s.prevPrices);

  const enabled = pairs.filter((p) => p.enabled);
  // Duplicate the list to make a seamless marquee
  const list = [...enabled, ...enabled];

  return (
    <div className="relative overflow-hidden border-y border-white/5 bg-black/20">
      <div className="marquee-track flex gap-6 py-2 whitespace-nowrap will-change-transform">
        {list.map((p, i) => {
          const px = prices[p.symbol] ?? p.basePrice;
          const prev = prevPrices[p.symbol] ?? p.basePrice;
          const delta = ((px - prev) / prev) * 100;
          const up = delta >= 0;
          return (
            <div
              key={`${p.symbol}-${i}`}
              className="flex items-center gap-2 px-3 py-1 rounded-md hover:bg-white/5 transition"
            >
              <span className="font-mono text-xs font-semibold text-foreground/90">
                {p.symbol}
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                ${fmtPrice(px)}
              </span>
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  up ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {up ? "▲" : "▼"} {fmtPct(delta)}
              </span>
            </div>
          );
        })}
      </div>
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
