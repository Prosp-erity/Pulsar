"use client";

import { useEffect, useState, useRef } from "react";
import { useLiveTradingStatus } from "@/hooks/use-live-trading-status";

export interface BingxBalance {
  totalEqUsd: number;
  uplUsd: number;
  uplRatio: number;
  details: { ccy: string; total: number; available: number }[];
}

export interface BingxPosition {
  symbol: string;
  positionSide: "LONG" | "SHORT";
  positionValue: string;
  positionAmt: string;
  avgPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  unrealizedPnlPct: string;
  cTime: string;
}

export interface BingxFill {
  symbol: string;
  side: "BUY" | "SELL";
  executedQty: string;
  executedPrice: string;
  fee: string;
  feeAsset: string;
  time: string;
  tradeId: string;
}

export interface BingxAccountState {
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  environment: "demo" | "live" | null;
  balance: BingxBalance | null;
  positions: BingxPosition[];
  fills: BingxFill[];
}

interface RawCreds {
  bingxApiKey: string;
  bingxApiSecret: string;
  bingxIsDemo: boolean;
  bingxStatus: string;
  liveTradingEnabled?: boolean;
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

function credHeaders(c: RawCreds) {
  return {
    "x-bingx-key": c.bingxApiKey,
    "x-bingx-secret": c.bingxApiSecret,
  };
}

async function probeAccount(c: RawCreds): Promise<{
  ok: boolean;
  environment?: "demo" | "live";
  balance?: BingxBalance | null;
  error?: string;
}> {
  try {
    const res = await fetch("/api/bingx?action=probe", { headers: credHeaders(c) });
    const j = await res.json();
    if (!res.ok || !j.ok) {
      return { ok: false, error: j.error ?? `HTTP ${res.status}` };
    }
    return {
      ok: true,
      environment: j.environment,
      balance: j.balance,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "fetch_failed" };
  }
}

async function fetchBalance(c: RawCreds, env: "demo" | "live"): Promise<{ ok: boolean; balance?: BingxBalance | null; error?: string }> {
  try {
    const res = await fetch(`/api/bingx?action=balance&env=${env}`, { headers: credHeaders(c) });
    const j = await res.json();
    if (!res.ok || !j.ok) {
      return { ok: false, error: j.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, balance: j.balance };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "fetch_failed" };
  }
}

async function fetchPositions(c: RawCreds, env: "demo" | "live"): Promise<{ ok: boolean; positions?: BingxPosition[]; error?: string }> {
  try {
    const res = await fetch(`/api/bingx?action=positions&env=${env}`, { headers: credHeaders(c) });
    const j = await res.json();
    if (!res.ok) {
      return { ok: false, error: j?.msg ?? `HTTP ${res.status}` };
    }
    const arr: BingxPosition[] = (j?.data ?? []).map((d: any) => ({
      symbol: d.symbol,
      positionSide: d.positionSide,
      positionValue: d.positionValue,
      positionAmt: d.positionAmt,
      avgPrice: d.avgPrice,
      markPrice: d.markPrice,
      unrealizedPnl: d.unrealizedPnl,
      unrealizedPnlPct: d.unrealizedPnlPct ?? "0",
      cTime: d.cTime,
    }));
    return { ok: true, positions: arr };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "fetch_failed" };
  }
}

async function fetchFills(c: RawCreds, env: "demo" | "live"): Promise<{ ok: boolean; fills?: BingxFill[]; error?: string }> {
  try {
    const res = await fetch(`/api/bingx?action=fills&env=${env}`, { headers: credHeaders(c) });
    const j = await res.json();
    if (!res.ok) {
      return { ok: false, error: j?.msg ?? `HTTP ${res.status}` };
    }
    const arr: BingxFill[] = (j?.data ?? []).map((d: any) => ({
      symbol: d.symbol,
      side: d.side,
      executedQty: d.executedQty,
      executedPrice: d.executedPrice,
      fee: d.fee,
      feeAsset: d.feeAsset,
      time: d.time,
      tradeId: d.tradeId,
    }));
    return { ok: true, fills: arr };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "fetch_failed" };
  }
}

const POLL_INTERVAL_MS = 15_000;

export function useBingxLiveAccount(): BingxAccountState {
  const live = useLiveTradingStatus();
  const [state, setState] = useState<BingxAccountState>({
    loading: false,
    error: null,
    lastUpdated: null,
    environment: null,
    balance: null,
    positions: [],
    fills: [],
  });
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const bingxActive = !!(live.liveActive && live.exchangeId === "bingx");

  useEffect(() => {
    if (!bingxActive) {
      const resetTimer = setTimeout(() => {
        setState({
          loading: false,
          error: null,
          lastUpdated: null,
          environment: null,
          balance: null,
          positions: [],
          fills: [],
        });
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    let cancelled = false;
    let probedEnv: "demo" | "live" | null = null;

    async function initialProbe() {
      const creds = readCreds();
      if (!creds) return;
      setState((s) => ({ ...s, loading: true, error: null }));
      const probe = await probeAccount(creds);
      if (cancelled) return;
      if (!probe.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          error: probe.error ?? "probe_failed",
        }));
        return;
      }
      probedEnv = probe.environment ?? "live";
      setState((s) => ({
        ...s,
        environment: probedEnv,
        balance: probe.balance ?? null,
        lastUpdated: Date.now(),
        loading: false,
      }));
      const [pos, fills] = await Promise.all([
        fetchPositions(creds, probedEnv),
        fetchFills(creds, probedEnv),
      ]);
      if (cancelled) return;
      setState((s) => ({
        ...s,
        positions: pos.ok ? pos.positions ?? [] : [],
        fills: fills.ok ? fills.fills ?? [] : [],
        lastUpdated: Date.now(),
      }));
    }

    async function poll() {
      if (!probedEnv) return;
      const creds = readCreds();
      if (!creds) return;
      const [b, p, f] = await Promise.all([
        fetchBalance(creds, probedEnv),
        fetchPositions(creds, probedEnv),
        fetchFills(creds, probedEnv),
      ]);
      if (cancelled) return;
      setState((s) => ({
        ...s,
        balance: b.ok ? b.balance ?? s.balance : s.balance,
        positions: p.ok ? p.positions ?? [] : [],
        fills: f.ok ? f.fills ?? [] : [],
        lastUpdated: Date.now(),
        error: b.ok ? null : b.error ?? null,
      }));
    }

    initialProbe();
    refreshTimer.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [bingxActive, live.exchangeId, live.liveActive, live.enabledAt]);

  return state;
}
