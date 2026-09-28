"use client";

import { useSyncExternalStore } from "react";

// ---------------- Types ----------------

export type ExchangeStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface LiveTradingSnapshot {
  /** Master switch — true means the user has flipped the Live switch ON */
  isLive: boolean;
  /** True only if at least one exchange shows connected AND live is on */
  liveActive: boolean;
  /** Display name of the live exchange ("Binance Mainnet", "OKX Live", "MT5 Bridge", "MetaAPI", "Bybit", "BingX", or null) */
  primaryExchange: string | null;
  /** Sub-mode label, e.g. "Testnet", "Demo", "Mainnet", "Live" */
  exchangeMode: string | null;
  /** Short identifier: "binance" | "okx" | "metaapi" | "mt5" | "bybit" | "bingx" */
  exchangeId: "binance" | "okx" | "metaapi" | "mt5" | "bybit" | "bingx" | null;
  /**
   * True if the connected exchange is on testnet/demo (not real funds).
   */
  isTestEnvironment: boolean;
  /** ISO timestamp string when live was enabled, or null */
  enabledAt: string | null;
}

const EMPTY: LiveTradingSnapshot = {
  isLive: false,
  liveActive: false,
  primaryExchange: null,
  exchangeMode: null,
  exchangeId: null,
  isTestEnvironment: false,
  enabledAt: null,
};

const CRED_KEY = "pulsar.credentials.v1";
const EVENT = "pulsar-creds-changed";

// ---------------- Snapshot builder ----------------

interface RawCreds {
  binanceApiKey: string;
  binanceApiSecret: string;
  binanceTestnet: boolean;
  binanceStatus: ExchangeStatus;
  okxApiKey: string;
  okxApiSecret: string;
  okxPassphrase: string;
  okxIsDemo: boolean;
  okxStatus: ExchangeStatus;
  metaApiToken: string;
  metaApiAccountId: string;
  metaApiStatus: ExchangeStatus;
  mt5BridgeUrl: string;
  mt5Status: ExchangeStatus;
  // Bybit
  bybitApiKey: string;
  bybitApiSecret: string;
  bybitIsDemo: boolean;
  bybitStatus: ExchangeStatus;
  // BingX
  bingxApiKey: string;
  bingxApiSecret: string;
  bingxIsDemo: boolean;
  bingxStatus: ExchangeStatus;
  liveTradingEnabled: boolean;
  liveEnabledAt?: string;
}

function readCreds(): RawCreds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CRED_KEY);
    if (!raw) return null;
    const decoded = atob(raw);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function buildSnapshot(): LiveTradingSnapshot {
  const c = readCreds();
  if (!c) return EMPTY;
  const isLive = !!c.liveTradingEnabled;
  // Determine primary connected exchange (priority: live environments first,
  // then any connected exchange).
  type Cand = {
    id: "binance" | "okx" | "metaapi" | "mt5" | "bybit" | "bingx";
    connected: boolean;
    name: string;
    mode: string;
    isTest: boolean;
  };
  const cands: Cand[] = [
    {
      id: "binance",
      connected: c.binanceStatus === "connected",
      name: "Binance",
      mode: c.binanceTestnet ? "Testnet" : "Mainnet",
      isTest: !!c.binanceTestnet,
    },
    {
      id: "okx",
      connected: c.okxStatus === "connected",
      name: "OKX",
      mode: c.okxIsDemo ? "Demo" : "Live",
      isTest: !!c.okxIsDemo,
    },
    {
      id: "metaapi",
      connected: c.metaApiStatus === "connected",
      name: "MetaAPI",
      mode: "MT4/5",
      isTest: false,
    },
    {
      id: "mt5",
      connected: c.mt5Status === "connected",
      name: "MT5 Bridge",
      mode: "Local",
      isTest: false,
    },
    {
      id: "bybit",
      connected: c.bybitStatus === "connected",
      name: "Bybit",
      mode: c.bybitIsDemo ? "Testnet" : "Mainnet",
      isTest: !!c.bybitIsDemo,
    },
    {
      id: "bingx",
      connected: c.bingxStatus === "connected",
      name: "BingX",
      mode: c.bingxIsDemo ? "Testnet" : "Mainnet",
      isTest: !!c.bingxIsDemo,
    },
  ];
  // Prefer live (non-test) connections, fall back to test connections
  const live = cands.find((x) => x.connected && !x.isTest);
  const test = cands.find((x) => x.connected && x.isTest);
  const any = cands.find((x) => x.connected);
  const pick = live ?? test ?? any ?? null;
  if (!pick) {
    return {
      isLive,
      liveActive: false,
      primaryExchange: null,
      exchangeMode: null,
      exchangeId: null,
      isTestEnvironment: false,
      enabledAt: c.liveEnabledAt ?? null,
    };
  }
  return {
    isLive,
    liveActive: isLive && pick.connected,
    primaryExchange: pick.name,
    exchangeMode: pick.mode,
    exchangeId: pick.id,
    isTestEnvironment: pick.isTest,
    enabledAt: c.liveEnabledAt ?? null,
  };
}

// ---------------- External store (hydration-safe) ----------------

let cachedClient: LiveTradingSnapshot = EMPTY;
let inited = false;

function initClient() {
  if (inited) return;
  inited = true;
  cachedClient = buildSnapshot();
  // Re-read on every event dispatched by LiveTradingConfig.saveCreds()
  window.addEventListener(EVENT, () => {
    cachedClient = buildSnapshot();
    emit();
  });
  // Also re-read on storage events (other tabs)
  window.addEventListener("storage", (e) => {
    if (e.key === CRED_KEY) {
      cachedClient = buildSnapshot();
      emit();
    }
  });
}

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  if (typeof window !== "undefined") initClient();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getClientSnapshot(): LiveTradingSnapshot {
  return cachedClient;
}
function getServerSnapshot(): LiveTradingSnapshot {
  return EMPTY;
}

export function useLiveTradingStatus(): LiveTradingSnapshot {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

// ---------------- Helper: write liveEnabledAt timestamp ----------------

/** Mark the moment live trading was enabled (called by LiveTradingConfig). */
export function stampLiveEnabledAt(enabled: boolean): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CRED_KEY);
    if (!raw) return null;
    const decoded = atob(raw);
    const obj = JSON.parse(decoded);
    if (enabled) {
      obj.liveEnabledAt = new Date().toISOString();
    } else {
      delete obj.liveEnabledAt;
    }
    const encoded = btoa(JSON.stringify(obj));
    window.localStorage.setItem(CRED_KEY, encoded);
    // Notify listeners
    window.dispatchEvent(new Event(EVENT));
    return obj.liveEnabledAt ?? null;
  } catch {
    return null;
  }
}
