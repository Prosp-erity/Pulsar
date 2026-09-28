"use client";

import { useEffect, useRef, useState } from "react";
import { useTradingStore } from "@/lib/store/trading-store";
import { useLiveTradingStatus } from "@/hooks/use-live-trading-status";
import { useBybitLiveAccount } from "@/hooks/use-bybit-live-account";

// ---------------- Types ----------------

interface OrderEvent {
  id: string;
  ts: number;
  status: "placed" | "filled" | "rejected" | "error";
  symbol: string;
  side: "Buy" | "Sell";
  qty: string;
  orderId?: string;
  error?: string;
}

// ---------------- Credentials accessor ----------------

interface RawCreds {
  bybitApiKey: string;
  bybitApiSecret: string;
}

const CRED_KEY = "pulsar.credentials.v1";

function readCreds(): RawCreds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CRED_KEY);
    if (!raw) return null;
    return JSON.parse(atob(raw));
  } catch {
    return null;
  }
}

// ---------------- Pair symbol → Bybit symbol helper ----------------

// Pulsar pairs look like "BTC/USDT"; Bybit spot symbols use "BTCUSDT".
function toBybitSymbol(pair: string): string {
  return pair.replace("/", "");
}

// ---------------- Hook ----------------

/**
 * Bridge that watches the simulated trading store for newly-opened
 * positions. When live trading is ON with Bybit connected, every new
 * simulated position triggers a REAL market order on Bybit (spot).
 * The Bybit orderId is logged in the events array so the UI can show
 * live trading activity.
 */
export function useBybitOrderBridge(): { events: OrderEvent[] } {
  const live = useLiveTradingStatus();
  const bybit = useBybitLiveAccount();
  const positions = useTradingStore((s) => s.positions);
  const prices = useTradingStore((s) => s.prices);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const placedRef = useRef<Set<string>>(new Set());

  const bybitLive = !!(live.liveActive && live.exchangeId === "bybit");

  useEffect(() => {
    if (!bybitLive || !bybit.environment) {
      placedRef.current.clear();
      return;
    }

    const creds = readCreds();
    if (!creds) return;

    const isDemo = bybit.environment === "demo";

    const pendingOrders: {
      posId: string;
      pair: string;
      side: "LONG" | "SHORT";
      size: number;
    }[] = [];
    for (const pos of positions) {
      if (placedRef.current.has(pos.id)) continue;
      placedRef.current.add(pos.id);
      pendingOrders.push({
        posId: pos.id,
        pair: pos.pair,
        side: pos.side,
        size: pos.size,
      });
    }

    for (const order of pendingOrders) {
      const symbol = toBybitSymbol(order.pair);
      const side: "Buy" | "Sell" =
        order.side === "LONG" ? "Buy" : "Sell";
      // Bybit spot market orders take qty in the BASE currency.
      // Round to 8 decimal places.
      const qty = (order.size ?? 0).toFixed(8).replace(/\.?0+$/, "") || "0";
      if (parseFloat(qty) <= 0) continue;
      const orderLinkId = `pulsar-${order.posId.slice(-12)}`.slice(0, 36);
      const posId = order.posId;

      (async () => {
        try {
          const res = await fetch(`/api/bybit/order?action=place`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey: creds.bybitApiKey,
              apiSecret: creds.bybitApiSecret,
              isDemo,
              symbol,
              side,
              qty,
              orderLinkId,
            }),
          });
          const data = await res.json();
          const ev: OrderEvent = {
            id: posId,
            ts: Date.now(),
            status: data.ok ? "placed" : "rejected",
            symbol,
            side,
            qty,
            orderId: data.orderId,
            error: data.error,
          };
          setEvents((prev) => [ev, ...prev].slice(0, 50));
        } catch (err: any) {
          const ev: OrderEvent = {
            id: posId,
            ts: Date.now(),
            status: "error",
            symbol,
            side,
            qty,
            error: err?.message ?? "fetch_failed",
          };
          setEvents((prev) => [ev, ...prev].slice(0, 50));
        }
      })();
    }

    // Clean up placedRef when positions close
    const currentIds = new Set(positions.map((p) => p.id));
    for (const id of Array.from(placedRef.current)) {
      if (!currentIds.has(id)) placedRef.current.delete(id);
    }
  }, [bybitLive, bybit.environment, positions, prices]);

  return { events };
}
