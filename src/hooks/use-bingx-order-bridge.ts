"use client";

import { useEffect, useRef, useState } from "react";
import { useTradingStore } from "@/lib/store/server-trading-store";
import { useLiveTradingStatus } from "@/hooks/use-live-trading-status";
import { useBingxLiveAccount } from "@/hooks/use-bingx-live-account";

interface OrderEvent {
  id: string;
  ts: number;
  status: "placed" | "filled" | "rejected" | "error";
  symbol: string;
  side: "BUY" | "SELL";
  qty: string;
  orderId?: string;
  error?: string;
}

interface RawCreds {
  bingxApiKey: string;
  bingxApiSecret: string;
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

// Pulsar pairs look like "BTC/USDT"; BingX spot symbols use "BTC-USDT".
function toBingxSymbol(pair: string): string {
  return pair.replace("/", "-");
}

export function useBingxOrderBridge(): { events: OrderEvent[] } {
  const live = useLiveTradingStatus();
  const bingx = useBingxLiveAccount();
  const positions = useTradingStore((s) => s.positions);
  const prices = useTradingStore((s) => s.prices);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const placedRef = useRef<Set<string>>(new Set());

  const bingxLive = !!(live.liveActive && live.exchangeId === "bingx");

  useEffect(() => {
    if (!bingxLive || !bingx.environment) {
      placedRef.current.clear();
      return;
    }

    const creds = readCreds();
    if (!creds) return;

    const isDemo = bingx.environment === "demo";

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
      const symbol = toBingxSymbol(order.pair);
      const side: "BUY" | "SELL" = order.side === "LONG" ? "BUY" : "SELL";
      const quantity = (order.size ?? 0).toFixed(8).replace(/\.?0+$/, "") || "0";
      if (parseFloat(quantity) <= 0) continue;
      const newClientOrderId = `pulsar-${order.posId.slice(-12)}`.slice(0, 32);
      const posId = order.posId;

      (async () => {
        try {
          const res = await fetch(`/api/bingx/order?action=place`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey: creds.bingxApiKey,
              apiSecret: creds.bingxApiSecret,
              isDemo,
              symbol,
              side,
              quantity,
              newClientOrderId,
            }),
          });
          const data = await res.json();
          const ev: OrderEvent = {
            id: posId,
            ts: Date.now(),
            status: data.ok ? "placed" : "rejected",
            symbol,
            side,
            qty: quantity,
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
            qty: quantity,
            error: err?.message ?? "fetch_failed",
          };
          setEvents((prev) => [ev, ...prev].slice(0, 50));
        }
      })();
    }

    const currentIds = new Set(positions.map((p) => p.id));
    for (const id of Array.from(placedRef.current)) {
      if (!currentIds.has(id)) placedRef.current.delete(id);
    }
  }, [bingxLive, bingx.environment, positions, prices]);

  return { events };
}
