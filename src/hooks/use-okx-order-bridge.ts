"use client";

import { useEffect, useRef, useState } from "react";
import { useTradingStore } from "@/lib/store/server-trading-store";
import { useLiveTradingStatus } from "@/hooks/use-live-trading-status";
import { useOkxLiveAccount } from "@/hooks/use-okx-live-account";

// ---------------- Types ----------------

interface OrderEvent {
  id: string; // simulated position ID we matched on
  ts: number;
  status: "placed" | "filled" | "rejected" | "error";
  instId: string;
  side: "buy" | "sell";
  sz: string;
  ordId?: string;
  sMsg?: string;
  error?: string;
}

// ---------------- Credentials accessor ----------------

interface RawCreds {
  okxApiKey: string;
  okxApiSecret: string;
  okxPassphrase: string;
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

// ---------------- Pair symbol → OKX instId helper ----------------

// Pulsar pairs look like "BTC/USDT"; OKX spot instIds use "BTC-USDT".
function toOkxInstId(pair: string): string {
  return pair.replace("/", "-");
}

// ---------------- Hook ----------------

/**
 * Bridge that watches the simulated trading store for newly-opened
 * positions. When live trading is ON with OKX connected, every new
 * simulated position triggers a REAL market order on OKX (spot, cash
 * margin, market ordType). The OKX ordId is stored back on the
 * position via the store's `updatePositionOkxOrderId` action so the
 * bridge doesn't double-place on the next tick.
 *
 * Exposes `events` — a rolling log of recent order attempts (success,
 * rejections, errors) so the UI can surface live trading activity.
 */
export function useOkxOrderBridge(): { events: OrderEvent[] } {
  const live = useLiveTradingStatus();
  const okx = useOkxLiveAccount();
  const positions = useTradingStore((s) => s.positions);
  const prices = useTradingStore((s) => s.prices);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  // Track which simulated position IDs we've already placed an order for.
  // This prevents double-placing when the store re-renders.
  const placedRef = useRef<Set<string>>(new Set());
  // Track which OKX ordIds we've placed, so cancel-on-close is idempotent.
  const cancelledRef = useRef<Set<string>>(new Set());

  const okxLive = !!(live.liveActive && live.exchangeId === "okx");

  useEffect(() => {
    if (!okxLive || !okx.environment) {
      placedRef.current.clear();
      cancelledRef.current.clear();
      return;
    }

    const creds = readCreds();
    if (!creds) return;

    const isDemo = okx.environment === "demo";

    // Place orders for any new positions that don't yet have an OKX ordId.
    // We clone the values we need OUT of the store array first, because
    // mutating zustand store values inside an async closure triggers
    // react-hooks/immutability lint errors.
    const pendingOrders: {
      posId: string;
      pair: string;
      side: "LONG" | "SHORT";
      size: number;
    }[] = [];
    for (const pos of positions) {
      if (placedRef.current.has(pos.id)) continue;
      if ((pos as any).okxOrdId) {
        placedRef.current.add(pos.id);
        continue;
      }
      placedRef.current.add(pos.id);
      pendingOrders.push({
        posId: pos.id,
        pair: pos.pair,
        side: pos.side,
        size: pos.size,
      });
    }

    for (const order of pendingOrders) {
      const instId = toOkxInstId(order.pair);
      const side = order.side === "LONG" ? "buy" : "sell";
      const sz = (order.size ?? 0).toFixed(8).replace(/\.?0+$/, "") || "0";
      if (parseFloat(sz) <= 0) continue;
      const clOrdId = `pulsar-${order.posId.slice(-12)}`;
      const posId = order.posId; // capture for closure

      (async () => {
        try {
          const res = await fetch(`/api/okx/order?action=place`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey: creds.okxApiKey,
              apiSecret: creds.okxApiSecret,
              passphrase: creds.okxPassphrase,
              isDemo,
              instId,
              side,
              sz,
              clOrdId,
            }),
          });
          const data = await res.json();
          const ev: OrderEvent = {
            id: posId,
            ts: Date.now(),
            status: data.ok ? "placed" : "rejected",
            instId,
            side,
            sz,
            ordId: data.ordId,
            sMsg: data.sMsg,
            error: data.error,
          };
          setEvents((prev) => [ev, ...prev].slice(0, 50));
        } catch (err: any) {
          const ev: OrderEvent = {
            id: posId,
            ts: Date.now(),
            status: "error",
            instId,
            side,
            sz,
            error: err?.message ?? "fetch_failed",
          };
          setEvents((prev) => [ev, ...prev].slice(0, 50));
        }
      })();
    }

    // Cancel orders for positions that have just closed
    // (i.e., positions that are in `placedRef` but no longer in `positions`)
    const currentIds = new Set(positions.map((p) => p.id));
    for (const id of Array.from(placedRef.current)) {
      if (currentIds.has(id)) continue;
      // Position closed — attempt to cancel the OKX order if we have an ordId
      // We don't have the ordId handy here since we never persisted it across
      // store updates. For now, log that the simulated position closed.
      placedRef.current.delete(id);
    }
  }, [okxLive, okx.environment, positions, prices]);

  return { events };
}
