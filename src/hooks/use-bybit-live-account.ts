"use client";

import { useEffect, useState, useRef } from "react";
import { useLiveTradingStatus } from "@/hooks/use-live-trading-status";

// ---------------- Types ----------------

export interface BybitBalance {
  totalEqUsd: number;
  uplUsd: number;
  uplRatio: number;
  details: { ccy: string; total: number; available: number }[];
}

export interface BybitPosition {
  symbol: string; // e.g. "BTCUSDT"
  side: "Buy" | "Sell" | "None";
  size: string;
  avgPrice: string;
  markPrice: string;
  unrealisedPnl: string;
  unrealisedPnlPct: string;
  createdTime: string;
}

export interface BybitFill {
  symbol: string;
  side: "Buy" | "Sell";
  execQty: string;
  execPrice: string;
  fee: string;
  feeTokenId: string;
  execTime: string;
  execId: string;
}

export interface BybitAccountState {
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  environment: "demo" | "live" | null;
  balance: BybitBalance | null;
  positions: BybitPosition[];
  fills: BybitFill[];
}

// ---------------- Credentials accessor ----------------

interface RawCreds {
  bybitApiKey: string;
  bybitApiSecret: string;
  bybitIsDemo: boolean;
  bybitStatus: string;
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

// ---------------- Fetch helpers ----------------

function credHeaders(c: RawCreds) {
  return {
    "x-bybit-key": c.bybitApiKey,
    "x-bybit-secret": c.bybitApiSecret,
  };
}

async function probeAccount(c: RawCreds): Promise<{
  ok: boolean;
  environment?: "demo" | "live";
  balance?: BybitBalance | null;
  error?: string;
}> {
  try {
    const res = await fetch("/api/bybit?action=probe", { headers: credHeaders(c) });
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

async function fetchBalance(
  c: RawCreds,
  env: "demo" | "live",
): Promise<{ ok: boolean; balance?: BybitBalance | null; error?: string }> {
  try {
    const res = await fetch(`/api/bybit?action=balance&env=${env}`, {
      headers: credHeaders(c),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) {
      return { ok: false, error: j.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, balance: j.balance };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "fetch_failed" };
  }
}

async function fetchPositions(
  c: RawCreds,
  env: "demo" | "live",
): Promise<{ ok: boolean; positions?: BybitPosition[]; error?: string }> {
  try {
    const res = await fetch(`/api/bybit?action=positions&env=${env}`, {
      headers: credHeaders(c),
    });
    const j = await res.json();
    if (!res.ok) {
      return { ok: false, error: j?.retMsg ?? `HTTP ${res.status}` };
    }
    const arr: BybitPosition[] = (j?.result?.list ?? []).map((d: any) => ({
      symbol: d.symbol,
      side: d.side,
      size: d.size,
      avgPrice: d.avgPrice,
      markPrice: d.markPrice,
      unrealisedPnl: d.unrealisedPnl,
      unrealisedPnlPct: d.unrealisedPnlPct ?? "0",
      createdTime: d.createdTime,
    }));
    return { ok: true, positions: arr };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "fetch_failed" };
  }
}

async function fetchFills(
  c: RawCreds,
  env: "demo" | "live",
): Promise<{ ok: boolean; fills?: BybitFill[]; error?: string }> {
  try {
    const res = await fetch(`/api/bybit?action=fills&env=${env}`, {
      headers: credHeaders(c),
    });
    const j = await res.json();
    if (!res.ok) {
      return { ok: false, error: j?.retMsg ?? `HTTP ${res.status}` };
    }
    const arr: BybitFill[] = (j?.result?.list ?? []).map((d: any) => ({
      symbol: d.symbol,
      side: d.side,
      execQty: d.execQty,
      execPrice: d.execPrice,
      fee: d.fee,
      feeTokenId: d.feeTokenId,
      execTime: d.execTime,
      execId: d.execId,
    }));
    return { ok: true, fills: arr };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "fetch_failed" };
  }
}

// ---------------- Hook ----------------

const POLL_INTERVAL_MS = 15_000;

export function useBybitLiveAccount(): BybitAccountState {
  const live = useLiveTradingStatus();
  const [state, setState] = useState<BybitAccountState>({
    loading: false,
    error: null,
    lastUpdated: null,
    environment: null,
    balance: null,
    positions: [],
    fills: [],
  });
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const bybitActive = !!(live.liveActive && live.exchangeId === "bybit");

  useEffect(() => {
    if (!bybitActive) {
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
  }, [bybitActive, live.exchangeId, live.liveActive, live.enabledAt]);

  return state;
}
