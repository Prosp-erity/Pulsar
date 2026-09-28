"use client";

import { useEffect, useState, useRef } from "react";
import { useLiveTradingStatus } from "@/hooks/use-live-trading-status";

// ---------------- Types ----------------

export interface OkxBalance {
  totalEqUsd: number;
  uplUsd: number;
  uplRatio: number;
  details: { ccy: string; total: number; available: number }[];
}

export interface OkxPosition {
  instId: string;
  posSide: "long" | "short" | "net";
  pos: string;
  avgPx: string;
  markPx: string;
  upl: string;
  uplRatio: string;
  notionalUsd: string;
  cTime: string;
}

export interface OkxFill {
  instId: string;
  side: "buy" | "sell";
  fillSz: string;
  fillPx: string;
  fee: string;
  feeCcy: string;
  ts: string;
  billId: string;
}

export interface OkxAccountState {
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  /** Detected environment: "demo" | "live" | null (not yet probed) */
  environment: "demo" | "live" | null;
  balance: OkxBalance | null;
  positions: OkxPosition[];
  fills: OkxFill[];
}

// ---------------- Credentials accessor ----------------

interface RawCreds {
  okxApiKey: string;
  okxApiSecret: string;
  okxPassphrase: string;
  okxIsDemo: boolean;
  okxStatus: string;
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
    "x-okx-key": c.okxApiKey,
    "x-okx-secret": c.okxApiSecret,
    "x-okx-passphrase": c.okxPassphrase,
  };
}

async function probeAccount(c: RawCreds): Promise<{
  ok: boolean;
  environment?: "demo" | "live";
  balance?: OkxBalance | null;
  error?: string;
}> {
  try {
    const res = await fetch("/api/okx?action=probe", {
      headers: credHeaders(c),
    });
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
): Promise<{ ok: boolean; balance?: OkxBalance | null; error?: string }> {
  try {
    const res = await fetch(
      `/api/okx?action=balance&env=${env}`,
      { headers: credHeaders(c) },
    );
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
): Promise<{ ok: boolean; positions?: OkxPosition[]; error?: string }> {
  try {
    const res = await fetch(
      `/api/okx?action=positions&env=${env}`,
      { headers: credHeaders(c) },
    );
    const j = await res.json();
    if (!res.ok) {
      return { ok: false, error: j?.msg ?? `HTTP ${res.status}` };
    }
    const arr: OkxPosition[] = (j?.data ?? []).map((d: any) => ({
      instId: d.instId,
      posSide: d.posSide,
      pos: d.pos,
      avgPx: d.avgPx,
      markPx: d.markPx,
      upl: d.upl,
      uplRatio: d.uplRatio,
      notionalUsd: d.notionalUsd,
      cTime: d.cTime,
    }));
    return { ok: true, positions: arr };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "fetch_failed" };
  }
}

async function fetchFills(
  c: RawCreds,
  env: "demo" | "live",
): Promise<{ ok: boolean; fills?: OkxFill[]; error?: string }> {
  try {
    const res = await fetch(
      `/api/okx?action=fills&env=${env}`,
      { headers: credHeaders(c) },
    );
    const j = await res.json();
    if (!res.ok) {
      return { ok: false, error: j?.msg ?? `HTTP ${res.status}` };
    }
    const arr: OkxFill[] = (j?.data ?? []).map((d: any) => ({
      instId: d.instId,
      side: d.side,
      fillSz: d.fillSz,
      fillPx: d.fillPx,
      fee: d.fee,
      feeCcy: d.feeCcy,
      ts: d.ts,
      billId: d.billId,
    }));
    return { ok: true, fills: arr };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "fetch_failed" };
  }
}

// ---------------- Hook ----------------

const POLL_INTERVAL_MS = 15_000; // 15s

export function useOkxLiveAccount(): OkxAccountState {
  const live = useLiveTradingStatus();
  const [state, setState] = useState<OkxAccountState>({
    loading: false,
    error: null,
    lastUpdated: null,
    environment: null,
    balance: null,
    positions: [],
    fills: [],
  });
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Only run when the user has live trading ON with OKX as the active exchange
  const okxActive =
    live.liveActive && live.exchangeId === "okx";

  useEffect(() => {
    if (!okxActive) {
      // Reset when not on OKX live — schedule on next tick to avoid
      // cascading renders from setState-in-effect.
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
      // Also fetch positions + fills (don't block on these)
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
  }, [okxActive, live.exchangeId, live.liveActive, live.enabledAt]);

  return state;
}
