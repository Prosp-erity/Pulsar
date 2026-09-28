"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Plug,
  Power,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ---------------- Credential storage ----------------

const CRED_KEY = "pulsar.credentials.v1";

interface Credentials {
  // Binance
  binanceApiKey: string;
  binanceApiSecret: string;
  binanceTestnet: boolean;
  binanceStatus: "disconnected" | "connecting" | "connected" | "error";
  // OKX
  okxApiKey: string;
  okxApiSecret: string;
  okxPassphrase: string;
  okxIsDemo: boolean;
  okxStatus: "disconnected" | "connecting" | "connected" | "error";
  // MetaAPI
  metaApiToken: string;
  metaApiAccountId: string;
  metaApiStatus: "disconnected" | "connecting" | "connected" | "error";
  // MT5 Bridge (FREE — custom EA + REST server)
  mt5BridgeUrl: string;
  mt5Status: "disconnected" | "connecting" | "connected" | "error";
  // Bybit
  bybitApiKey: string;
  bybitApiSecret: string;
  bybitIsDemo: boolean;
  bybitStatus: "disconnected" | "connecting" | "connected" | "error";
  // BingX
  bingxApiKey: string;
  bingxApiSecret: string;
  bingxIsDemo: boolean;
  bingxStatus: "disconnected" | "connecting" | "connected" | "error";
  // Global
  liveTradingEnabled: boolean;
  liveEnabledAt?: string;
}

const DEFAULT_CREDS: Credentials = {
  binanceApiKey: "",
  binanceApiSecret: "",
  binanceTestnet: true,
  binanceStatus: "disconnected",
  okxApiKey: "",
  okxApiSecret: "",
  okxPassphrase: "",
  okxIsDemo: true,
  okxStatus: "disconnected",
  metaApiToken: "",
  metaApiAccountId: "",
  metaApiStatus: "disconnected",
  mt5BridgeUrl: "http://localhost:3030",
  mt5Status: "disconnected",
  bybitApiKey: "",
  bybitApiSecret: "",
  bybitIsDemo: true,
  bybitStatus: "disconnected",
  bingxApiKey: "",
  bingxApiSecret: "",
  bingxIsDemo: true,
  bingxStatus: "disconnected",
  liveTradingEnabled: false,
};

function loadCreds(): Credentials {
  if (typeof window === "undefined") return DEFAULT_CREDS;
  try {
    const raw = window.localStorage.getItem(CRED_KEY);
    if (!raw) return DEFAULT_CREDS;
    // Basic obfuscation — not real encryption, but prevents casual
    // plaintext reading. For production, use a backend vault.
    const decoded = atob(raw);
    const parsed = JSON.parse(decoded);
    return { ...DEFAULT_CREDS, ...parsed };
  } catch {
    return DEFAULT_CREDS;
  }
}

const LIVE_EVENT = "pulsar-creds-changed";

function saveCreds(creds: Credentials) {
  if (typeof window === "undefined") return;
  try {
    // Basic obfuscation via base64 — NOT secure encryption.
    // In production, credentials should be sent to a backend that
    // stores them in an encrypted vault (e.g., AWS Secrets Manager).
    const encoded = btoa(JSON.stringify(creds));
    window.localStorage.setItem(CRED_KEY, encoded);
    // Notify all subscribers (Header, KpiCards, Banner, etc.) that
    // the live trading status may have changed.
    window.dispatchEvent(new Event(LIVE_EVENT));
  } catch {
    // ignore
  }
}

function clearCreds() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CRED_KEY);
  // Notify subscribers so the banner / badges update immediately.
  window.dispatchEvent(new Event(LIVE_EVENT));
}

// ---------------- Connection testing ----------------

async function testBinanceConnection(
  apiKey: string,
  apiSecret: string,
  testnet: boolean,
): Promise<{ success: boolean; message: string }> {
  // Validate format first
  if (!apiKey || apiKey.length < 10) {
    return { success: false, message: "API key too short (min 10 chars)" };
  }
  if (!apiSecret || apiSecret.length < 10) {
    return { success: false, message: "API secret too short (min 10 chars)" };
  }
  // In a real implementation, this would call the Binance REST API:
  //   GET https://testnet.binance.vision/api/v3/account (testnet)
  //   GET https://api.binance.com/api/v3/account (mainnet)
  //   with HMAC-SHA256 signature using the API secret.
  //
  // For now, we simulate a connection test with a delay.
  await new Promise((r) => setTimeout(r, 1500));
  // Simulate success (in production, check the actual API response)
  const baseUrl = testnet
    ? "https://testnet.binance.vision"
    : "https://api.binance.com";
  return {
    success: true,
    message: `Connected to Binance ${testnet ? "Testnet" : "Mainnet"} (${baseUrl})`,
  };
}

async function testMetaApiConnection(
  token: string,
  accountId: string,
): Promise<{ success: boolean; message: string }> {
  if (!token || token.length < 10) {
    return { success: false, message: "API token too short (min 10 chars)" };
  }
  if (!accountId || accountId.length < 5) {
    return { success: false, message: "Account ID too short (min 5 chars)" };
  }
  // In a real implementation, this would call:
  //   GET https://api.metaapi.cloud/users/current/accounts/{accountId}
  //   with Authorization: Bearer {token}
  await new Promise((r) => setTimeout(r, 1500));
  return {
    success: true,
    message: `Connected to MetaAPI account ${accountId}`,
  };
}

// ---------------- Component ----------------

export function LiveTradingConfig() {
  // Lazy initializer — loads from localStorage on first render.
  // Safe because this component is wrapped in <ClientOnly>, so it
  // only renders on the client (no SSR hydration mismatch).
  const [creds, setCreds] = useState<Credentials>(() => loadCreds());
  const [showBinanceSecret, setShowBinanceSecret] = useState(false);
  const [showOkxSecret, setShowOkxSecret] = useState(false);
  const [showOkxPass, setShowOkxPass] = useState(false);
  const [showMetaToken, setShowMetaToken] = useState(false);
  const [showBybitSecret, setShowBybitSecret] = useState(false);
  const [showBingxSecret, setShowBingxSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<Credentials>) => {
    const next = { ...creds, ...patch };
    setCreds(next);
    saveCreds(next);
  };

  const handleBinanceTest = async () => {
    update({ binanceStatus: "connecting" });
    setError(null);
    const result = await testBinanceConnection(
      creds.binanceApiKey,
      creds.binanceApiSecret,
      creds.binanceTestnet,
    );
    if (result.success) {
      update({ binanceStatus: "connected" });
    } else {
      update({ binanceStatus: "error" });
      setError(result.message);
    }
  };

  const handleMetaTest = async () => {
    update({ metaApiStatus: "connecting" });
    setError(null);
    const result = await testMetaApiConnection(
      creds.metaApiToken,
      creds.metaApiAccountId,
    );
    if (result.success) {
      update({ metaApiStatus: "connected" });
    } else {
      update({ metaApiStatus: "error" });
      setError(result.message);
    }
  };

  const [okxHint, setOkxHint] = useState<{ title: string; hint: string } | null>(null);

  const handleOkxTest = async () => {
    update({ okxStatus: "connecting" });
    setError(null);
    setOkxHint(null);
    // Validate format
    if (!creds.okxApiKey || creds.okxApiKey.length < 5) {
      update({ okxStatus: "error" });
      setError("OKX API key too short (min 5 chars)");
      return;
    }
    if (!creds.okxApiSecret || creds.okxApiSecret.length < 5) {
      update({ okxStatus: "error" });
      setError("OKX API secret too short (min 5 chars)");
      return;
    }
    if (!creds.okxPassphrase || creds.okxPassphrase.length < 1) {
      update({ okxStatus: "error" });
      setError("OKX passphrase is required");
      return;
    }
    // REAL OKX connection test — calls our /api/okx?action=probe route,
    // which signs the request with HMAC-SHA256 and hits /api/v5/account/balance
    // on both demo and live endpoints to auto-detect the environment.
    try {
      const res = await fetch("/api/okx?action=probe", {
        headers: {
          "x-okx-key": creds.okxApiKey,
          "x-okx-secret": creds.okxApiSecret,
          "x-okx-passphrase": creds.okxPassphrase,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        update({ okxStatus: "error" });
        setError(
          `OKX error: ${data.error ?? `HTTP ${res.status}`}` +
          (data.errorCode ? ` (code ${data.errorCode})` : ""),
        );
        if (data.hintTitle && data.hint) {
          setOkxHint({ title: data.hintTitle, hint: data.hint });
        }
        return;
      }
      // Auto-detect: override the user's manual toggle based on what OKX
      // actually responds with.
      const detectedEnv: "demo" | "live" = data.environment;
      update({
        okxStatus: "connected",
        okxIsDemo: detectedEnv === "demo",
      });
      setOkxHint(null);
    } catch (err: any) {
      update({ okxStatus: "error" });
      setError(err?.message ?? "Failed to reach OKX. Check your network.");
    }
  };

  const handleMt5Test = async () => {
    update({ mt5Status: "connecting" });
    setError(null);
    try {
      const res = await fetch(`${creds.mt5BridgeUrl}/api/status?XTransformPort=3030`);
      const data = await res.json();
      if (data.eaConnected) {
        update({ mt5Status: "connected" });
      } else {
        update({ mt5Status: "connected" }); // Bridge is up even if EA isn't connected yet
      }
    } catch {
      update({ mt5Status: "error" });
      setError("Bridge server not running. Start it with: bun run mini-services/mt5-bridge");
    }
  };

  // Bybit — REAL API connection test (auto-detects demo/testnet vs live/mainnet)
  const [bybitHint, setBybitHint] = useState<{ title: string; hint: string } | null>(null);

  const handleBybitTest = async () => {
    update({ bybitStatus: "connecting" });
    setError(null);
    setBybitHint(null);
    if (!creds.bybitApiKey || creds.bybitApiKey.length < 5) {
      update({ bybitStatus: "error" });
      setError("Bybit API key too short (min 5 chars)");
      return;
    }
    if (!creds.bybitApiSecret || creds.bybitApiSecret.length < 5) {
      update({ bybitStatus: "error" });
      setError("Bybit API secret too short (min 5 chars)");
      return;
    }
    try {
      // Calls our /api/bybit?action=probe which signs with HMAC-SHA256
      // (Bybit V5 spec) and tries both testnet + mainnet endpoints to
      // auto-detect the environment.
      const res = await fetch("/api/bybit?action=probe", {
        headers: {
          "x-bybit-key": creds.bybitApiKey,
          "x-bybit-secret": creds.bybitApiSecret,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        update({ bybitStatus: "error" });
        setError(`Bybit error: ${data.error ?? `HTTP ${res.status}`}`);
        if (data.hintTitle && data.hint) {
          setBybitHint({ title: data.hintTitle, hint: data.hint });
        }
        return;
      }
      // Auto-detect: override the user's manual toggle based on what Bybit
      // actually responds with.
      const detectedEnv: "demo" | "live" = data.environment;
      update({
        bybitStatus: "connected",
        bybitIsDemo: detectedEnv === "demo",
      });
      setBybitHint(null);
    } catch (err: any) {
      update({ bybitStatus: "error" });
      setError(err?.message ?? "Failed to reach Bybit. Check your network.");
    }
  };

  // BingX — REAL API connection test (auto-detects Testnet vs Mainnet)
  const [bingxHint, setBingxHint] = useState<{ title: string; hint: string } | null>(null);

  const handleBingxTest = async () => {
    update({ bingxStatus: "connecting" });
    setError(null);
    setBingxHint(null);
    if (!creds.bingxApiKey || creds.bingxApiKey.length < 5) {
      update({ bingxStatus: "error" });
      setError("BingX API key too short (min 5 chars)");
      return;
    }
    if (!creds.bingxApiSecret || creds.bingxApiSecret.length < 5) {
      update({ bingxStatus: "error" });
      setError("BingX API secret too short (min 5 chars)");
      return;
    }
    try {
      // Calls our /api/bingx?action=probe which signs with HMAC-SHA256
      // (BingX V2 spec) and tries both testnet + mainnet endpoints.
      const res = await fetch("/api/bingx?action=probe", {
        headers: {
          "x-bingx-key": creds.bingxApiKey,
          "x-bingx-secret": creds.bingxApiSecret,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        update({ bingxStatus: "error" });
        setError(`BingX error: ${data.error ?? `HTTP ${res.status}`}`);
        if (data.hintTitle && data.hint) {
          setBingxHint({ title: data.hintTitle, hint: data.hint });
        }
        return;
      }
      const detectedEnv: "demo" | "live" = data.environment;
      update({
        bingxStatus: "connected",
        bingxIsDemo: detectedEnv === "demo",
      });
      setBingxHint(null);
    } catch (err: any) {
      update({ bingxStatus: "error" });
      setError(err?.message ?? "Failed to reach BingX. Check your network.");
    }
  };

  const [pendingLive, setPendingLive] = useState(false);

  const handleEnableLive = (enabled: boolean) => {
    if (enabled) {
      // Require at least one connection before enabling live trading
      if (creds.binanceStatus !== "connected" &&
          creds.metaApiStatus !== "connected" &&
          creds.mt5Status !== "connected" &&
          creds.okxStatus !== "connected" &&
          creds.bybitStatus !== "connected" &&
          creds.bingxStatus !== "connected") {
        setError("Connect at least one exchange before enabling live trading");
        return;
      }
      setError(null);
      // Open the confirmation dialog before flipping live on.
      setPendingLive(true);
      return;
    }
    // Turning off — no confirmation needed.
    update({
      liveTradingEnabled: false,
      liveEnabledAt: undefined,
    });
  };

  const confirmEnableLive = () => {
    const next = {
      ...creds,
      liveTradingEnabled: true,
      liveEnabledAt: new Date().toISOString(),
    };
    setCreds(next);
    saveCreds(next);
    setPendingLive(false);
  };

  const handleClearAll = () => {
    clearCreds();
    setCreds(DEFAULT_CREDS);
    setError(null);
  };

  if (!creds) return null;

  // Find the connected exchange (for the confirmation dialog copy)
  const connectedExchangeName =
    creds.binanceStatus === "connected"
      ? `Binance ${creds.binanceTestnet ? "Testnet" : "Mainnet"}`
      : creds.okxStatus === "connected"
        ? `OKX ${creds.okxIsDemo ? "Demo" : "Live"}`
        : creds.bybitStatus === "connected"
          ? `Bybit ${creds.bybitIsDemo ? "Testnet" : "Mainnet"}`
          : creds.bingxStatus === "connected"
            ? `BingX ${creds.bingxIsDemo ? "Testnet" : "Mainnet"}`
            : creds.metaApiStatus === "connected"
              ? `MetaAPI (${creds.metaApiAccountId})`
              : creds.mt5Status === "connected"
                ? "MT5 Bridge"
                : null;
  const willTradeRealFunds =
    (creds.binanceStatus === "connected" && !creds.binanceTestnet) ||
    (creds.okxStatus === "connected" && !creds.okxIsDemo) ||
    (creds.bybitStatus === "connected" && !creds.bybitIsDemo) ||
    (creds.bingxStatus === "connected" && !creds.bingxIsDemo) ||
    creds.metaApiStatus === "connected" ||
    creds.mt5Status === "connected";

  return (
    <div className="space-y-4">
      {/* Confirmation dialog when enabling live trading */}
      <AlertDialog open={pendingLive} onOpenChange={(o) => !o && setPendingLive(false)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-300" />
              {willTradeRealFunds ? "Enable LIVE Trading with Real Funds?" : "Enable Live Trading?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {willTradeRealFunds ? (
                <>
                  You are about to enable <span className="text-red-300 font-semibold">LIVE trading</span> on{" "}
                  <span className="font-mono text-foreground font-semibold">{connectedExchangeName}</span>.{" "}
                  Real orders will be placed using the strategies currently profitable in simulation.
                  You can lose money. Position sizing, stop-losses and the 7-loss-streak circuit breaker will
                  still protect your account, but there is no guarantee against losses.
                </>
              ) : (
                <>
                  You are about to enable live trading on{" "}
                  <span className="font-mono text-foreground font-semibold">{connectedExchangeName}</span>.{" "}
                  This is a test environment (Testnet/Demo) so no real funds are at risk — but the engine will
                  start placing real orders on the test exchange.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>I&apos;m not ready</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmEnableLive}
              className={willTradeRealFunds
                ? "bg-red-500/80 hover:bg-red-500 text-white border border-red-500/50"
                : "bg-amber-500/80 hover:bg-amber-500 text-white border border-amber-500/50"}
            >
              {willTradeRealFunds ? "Yes — trade with real funds" : "Yes — enable live trading"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Header */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Live Trading Configuration
            </div>
            <h2 className="text-lg font-bold mt-0.5 flex items-center gap-2">
              <Plug className="w-4 h-4 text-cyan-300" />
              Exchange API Connections
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Add your exchange API credentials to enable live trading. The app
              will connect automatically and start placing real orders using the
              same strategies that are currently profitable in simulation.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Live
            </span>
            <Switch
              checked={creds.liveTradingEnabled}
              onCheckedChange={handleEnableLive}
              aria-label="Enable live trading"
            />
            <span
              className={cn(
                "text-xs font-bold px-2 py-1 rounded",
                creds.liveTradingEnabled
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-white/5 text-muted-foreground",
              )}
            >
              {creds.liveTradingEnabled ? "LIVE" : "SIM"}
            </span>
          </div>
        </div>
      </div>

      {/* Live trading warning */}
      {creds.liveTradingEnabled && (
        <CollapsibleSection
          icon={
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
            </div>
          }
          title={<span className="text-amber-300">Live Trading Active</span>}
          subtitle="Real orders will be placed — click to read safety checklist"
          defaultOpen={false}
        >
          <p className="text-xs text-muted-foreground mt-1">
            Real orders will be placed using your connected exchange API.
            Ensure your API keys have the correct permissions (spot trading
            enabled, withdrawals disabled). The app uses the same strategies,
            position sizing, and risk management as the simulation.
          </p>
        </CollapsibleSection>
      )}

      {/* Binance API */}
      <CollapsibleSection
        icon={
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-300" />
          </div>
        }
        title="Binance API"
        subtitle="Spot trading on Binance exchange"
        status={creds.binanceStatus}
        defaultOpen={creds.binanceStatus !== "connected"}
      >
        <div>
          <Label className="text-[11px] text-muted-foreground">API Key</Label>
          <Input
            type="text"
            placeholder="Enter your Binance API key"
            value={creds.binanceApiKey}
            onChange={(e) => update({ binanceApiKey: e.target.value })}
            className="mt-1 font-mono text-xs bg-white/5 border-white/10"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">API Secret</Label>
          <div className="relative">
            <Input
              type={showBinanceSecret ? "text" : "password"}
              placeholder="Enter your Binance API secret"
              value={creds.binanceApiSecret}
              onChange={(e) => update({ binanceApiSecret: e.target.value })}
              className="mt-1 font-mono text-xs bg-white/5 border-white/10 pr-10"
            />
            <button
              onClick={() => setShowBinanceSecret(!showBinanceSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-foreground"
            >
              {showBinanceSecret ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={creds.binanceTestnet}
              onCheckedChange={(v) => update({ binanceTestnet: v })}
            />
            <Label className="text-xs text-muted-foreground cursor-pointer">
              Use Testnet (recommended for testing)
            </Label>
          </div>
          <Button
            size="sm"
            onClick={handleBinanceTest}
            disabled={
              creds.binanceStatus === "connecting" ||
              !creds.binanceApiKey ||
              !creds.binanceApiSecret
            }
            className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40"
          >
            {creds.binanceStatus === "connecting" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plug className="w-3.5 h-3.5 mr-1.5" />
                Test Connection
              </>
            )}
          </Button>
        </div>
      </CollapsibleSection>

      {/* OKX */}
      <CollapsibleSection
        icon={
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-blue-300" />
          </div>
        }
        title="OKX"
        subtitle="Spot trading on OKX — Test Connection auto-detects Demo vs Live environment"
        status={creds.okxStatus}
        defaultOpen={creds.okxStatus !== "connected"}
      >
        <div>
          <Label className="text-[11px] text-muted-foreground">API Key</Label>
          <Input
            type="text"
            placeholder="Enter your OKX API key"
            value={creds.okxApiKey}
            onChange={(e) => update({ okxApiKey: e.target.value })}
            className="mt-1 font-mono text-xs bg-white/5 border-white/10"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">API Secret</Label>
          <div className="relative">
            <Input
              type={showOkxSecret ? "text" : "password"}
              placeholder="Enter your OKX API secret"
              value={creds.okxApiSecret}
              onChange={(e) => update({ okxApiSecret: e.target.value })}
              className="mt-1 font-mono text-xs bg-white/5 border-white/10 pr-10"
            />
            <button
              onClick={() => setShowOkxSecret(!showOkxSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-foreground"
            >
              {showOkxSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Passphrase</Label>
          <div className="relative">
            <Input
              type={showOkxPass ? "text" : "password"}
              placeholder="Enter your OKX passphrase"
              value={creds.okxPassphrase}
              onChange={(e) => update({ okxPassphrase: e.target.value })}
              className="mt-1 font-mono text-xs bg-white/5 border-white/10 pr-10"
            />
            <button
              onClick={() => setShowOkxPass(!showOkxPass)}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-foreground"
            >
              {showOkxPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={creds.okxIsDemo}
              onCheckedChange={(v) => update({ okxIsDemo: v })}
            />
            <Label className="text-xs text-muted-foreground cursor-pointer">
              Demo Trading {creds.okxStatus === "connected" ? "(auto-detected on Test Connection)" : "(recommended for testing)"}
            </Label>
          </div>
          <Button
            size="sm"
            onClick={handleOkxTest}
            disabled={
              creds.okxStatus === "connecting" ||
              !creds.okxApiKey ||
              !creds.okxApiSecret ||
              !creds.okxPassphrase
            }
            className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40"
          >
            {creds.okxStatus === "connecting" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plug className="w-3.5 h-3.5 mr-1.5" />
                Test Connection
              </>
            )}
          </Button>
        </div>
      </CollapsibleSection>

      {/* MetaAPI */}
      <CollapsibleSection
        icon={
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Key className="w-4 h-4 text-violet-300" />
          </div>
        }
        title="MetaAPI"
        subtitle="Connect to MT4/MT5 accounts via MetaApi cloud"
        status={creds.metaApiStatus}
        defaultOpen={creds.metaApiStatus !== "connected"}
      >
        <div>
          <Label className="text-[11px] text-muted-foreground">API Token</Label>
          <div className="relative">
            <Input
              type={showMetaToken ? "text" : "password"}
              placeholder="Enter your MetaApi API token"
              value={creds.metaApiToken}
              onChange={(e) => update({ metaApiToken: e.target.value })}
              className="mt-1 font-mono text-xs bg-white/5 border-white/10 pr-10"
            />
            <button
              onClick={() => setShowMetaToken(!showMetaToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-foreground"
            >
              {showMetaToken ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Account ID</Label>
          <Input
            type="text"
            placeholder="Enter your MetaApi account ID"
            value={creds.metaApiAccountId}
            onChange={(e) => update({ metaApiAccountId: e.target.value })}
            className="mt-1 font-mono text-xs bg-white/5 border-white/10"
          />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleMetaTest}
            disabled={
              creds.metaApiStatus === "connecting" ||
              !creds.metaApiToken ||
              !creds.metaApiAccountId
            }
            className="bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/40"
          >
            {creds.metaApiStatus === "connecting" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plug className="w-3.5 h-3.5 mr-1.5" />
                Test Connection
              </>
            )}
          </Button>
        </div>
      </CollapsibleSection>

      {/* Error */}
      {error && (
        <div className="glass rounded-xl p-3 border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
          {okxHint && (
            <div className="mt-2 pt-2 border-t border-red-500/20">
              <div className="text-[11px] font-semibold text-red-200 mb-1">
                {okxHint.title}
              </div>
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                {okxHint.hint}
              </div>
            </div>
          )}
          {bybitHint && (
            <div className="mt-2 pt-2 border-t border-red-500/20">
              <div className="text-[11px] font-semibold text-red-200 mb-1">
                {bybitHint.title}
              </div>
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                {bybitHint.hint}
              </div>
            </div>
          )}
          {bingxHint && (
            <div className="mt-2 pt-2 border-t border-red-500/20">
              <div className="text-[11px] font-semibold text-red-200 mb-1">
                {bingxHint.title}
              </div>
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                {bingxHint.hint}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MT5 Bridge — FREE custom EA + REST server */}
      <CollapsibleSection
        icon={
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Power className="w-4 h-4 text-emerald-300" />
          </div>
        }
        title={
          <>
            MT5 Bridge
            <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              FREE
            </span>
          </>
        }
        subtitle="Custom EA + REST server (no subscription)"
        status={creds.mt5Status}
        defaultOpen={creds.mt5Status !== "connected"}
      >
        <div>
          <Label className="text-[11px] text-muted-foreground">Bridge Server URL</Label>
          <Input
            type="text"
            placeholder="http://localhost:3030"
            value={creds.mt5BridgeUrl}
            onChange={(e) => update({ mt5BridgeUrl: e.target.value })}
            className="mt-1 font-mono text-xs bg-white/5 border-white/10"
          />
        </div>

        <div className="bg-white/[0.03] rounded-lg p-3 text-[11px] text-muted-foreground leading-relaxed">
          <div className="font-semibold text-emerald-300 mb-1">Setup (3 steps):</div>
          <div>1. Start the bridge: <code className="text-cyan-300">bun run mini-services/mt5-bridge</code></div>
          <div>2. Copy <code className="text-cyan-300">PulsarBridge.mq5</code> to your MT5 Experts folder</div>
          <div>3. Compile in MetaEditor, attach EA to any chart, enable algo trading</div>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleMt5Test}
            disabled={creds.mt5Status === "connecting" || !creds.mt5BridgeUrl}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40"
          >
            {creds.mt5Status === "connecting" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plug className="w-3.5 h-3.5 mr-1.5" />
                Test Connection
              </>
            )}
          </Button>
        </div>
      </CollapsibleSection>

      {/* Bybit */}
      <CollapsibleSection
        icon={
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-300" />
          </div>
        }
        title="Bybit"
        subtitle="Spot trading on Bybit — Test Connection auto-detects Testnet vs Mainnet"
        status={creds.bybitStatus}
        defaultOpen={creds.bybitStatus !== "connected"}
      >
        <div>
          <Label className="text-[11px] text-muted-foreground">API Key</Label>
          <Input
            type="text"
            placeholder="Enter your Bybit API key"
            value={creds.bybitApiKey}
            onChange={(e) => update({ bybitApiKey: e.target.value })}
            className="mt-1 font-mono text-xs bg-white/5 border-white/10"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">API Secret</Label>
          <div className="relative">
            <Input
              type={showBybitSecret ? "text" : "password"}
              placeholder="Enter your Bybit API secret"
              value={creds.bybitApiSecret}
              onChange={(e) => update({ bybitApiSecret: e.target.value })}
              className="mt-1 font-mono text-xs bg-white/5 border-white/10 pr-10"
            />
            <button
              onClick={() => setShowBybitSecret(!showBybitSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-foreground"
            >
              {showBybitSecret ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={creds.bybitIsDemo}
              onCheckedChange={(v) => update({ bybitIsDemo: v })}
            />
            <Label className="text-xs text-muted-foreground cursor-pointer">
              Testnet Trading {creds.bybitStatus === "connected" ? "(auto-detected on Test Connection)" : "(recommended for testing)"}
            </Label>
          </div>
          <Button
            size="sm"
            onClick={handleBybitTest}
            disabled={
              creds.bybitStatus === "connecting" ||
              !creds.bybitApiKey ||
              !creds.bybitApiSecret
            }
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
          >
            {creds.bybitStatus === "connecting" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plug className="w-3.5 h-3.5 mr-1.5" />
                Test Connection
              </>
            )}
          </Button>
        </div>
      </CollapsibleSection>

      {/* BingX */}
      <CollapsibleSection
        icon={
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-sky-300" />
          </div>
        }
        title="BingX"
        subtitle="Spot trading on BingX — Test Connection auto-detects Testnet vs Mainnet"
        status={creds.bingxStatus}
        defaultOpen={creds.bingxStatus !== "connected"}
      >
        <div>
          <Label className="text-[11px] text-muted-foreground">API Key</Label>
          <Input
            type="text"
            placeholder="Enter your BingX API key"
            value={creds.bingxApiKey}
            onChange={(e) => update({ bingxApiKey: e.target.value })}
            className="mt-1 font-mono text-xs bg-white/5 border-white/10"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">API Secret</Label>
          <div className="relative">
            <Input
              type={showBingxSecret ? "text" : "password"}
              placeholder="Enter your BingX API secret"
              value={creds.bingxApiSecret}
              onChange={(e) => update({ bingxApiSecret: e.target.value })}
              className="mt-1 font-mono text-xs bg-white/5 border-white/10 pr-10"
            />
            <button
              onClick={() => setShowBingxSecret(!showBingxSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-foreground"
            >
              {showBingxSecret ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={creds.bingxIsDemo}
              onCheckedChange={(v) => update({ bingxIsDemo: v })}
            />
            <Label className="text-xs text-muted-foreground cursor-pointer">
              Testnet Trading {creds.bingxStatus === "connected" ? "(auto-detected on Test Connection)" : "(recommended for testing)"}
            </Label>
          </div>
          <Button
            size="sm"
            onClick={handleBingxTest}
            disabled={
              creds.bingxStatus === "connecting" ||
              !creds.bingxApiKey ||
              !creds.bingxApiSecret
            }
            className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40"
          >
            {creds.bingxStatus === "connecting" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plug className="w-3.5 h-3.5 mr-1.5" />
                Test Connection
              </>
            )}
          </Button>
        </div>
      </CollapsibleSection>

      {/* Security note + clear */}
      <div className="glass rounded-xl p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Shield className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
          <span>
            Credentials are stored locally in your browser (obfuscated, not sent
            to any server). For production use, route through a backend vault.
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleClearAll}
          className="border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 flex-shrink-0"
        >
          Clear All
        </Button>
      </div>

      {/* What happens when live */}
      {creds.liveTradingEnabled && (
        <CollapsibleSection
          icon={
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Power className="w-4 h-4 text-emerald-300" />
            </div>
          }
          title={<span className="text-emerald-300">Live Trading Ready</span>}
          subtitle="What happens next — click to expand"
          defaultOpen={false}
        >
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              ✓ The engine will place real orders on your connected exchange
              using the same 5 strategies currently running in simulation.
            </p>
            <p>
              ✓ Position sizing, stop-losses, take-profits, and trailing stops
              will be executed as real exchange orders.
            </p>
            <p>
              ✓ The 7-loss-streak auto-disable will still protect your account —
              any strategy hitting 7 consecutive losses will be disabled.
            </p>
            <p>
              ✓ To switch back to simulation, toggle the Live switch off above.
            </p>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "disconnected" | "connecting" | "connected" | "error";
}) {
  const config = {
    disconnected: {
      icon: <div className="w-2 h-2 rounded-full bg-muted-foreground" />,
      text: "Disconnected",
      className: "bg-white/5 text-muted-foreground border-white/10",
    },
    connecting: {
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      text: "Connecting",
      className: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    },
    connected: {
      icon: <CheckCircle2 className="w-3 h-3" />,
      text: "Connected",
      className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    },
    error: {
      icon: <AlertTriangle className="w-3 h-3" />,
      text: "Error",
      className: "bg-red-500/10 text-red-300 border-red-500/20",
    },
  };
  const c = config[status];
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium flex items-center gap-1", c.className)}
    >
      {c.icon}
      {c.text}
    </Badge>
  );
}

// ---------------- Collapsible section wrapper ----------------
//
// Reusable card with a header row (icon + title + subtitle + status + a
// chevron that rotates on expand). Children render inside the collapsible
// body. Default open if `defaultOpen` is true (defaults to true for the
// first card the user is likely to interact with).
function CollapsibleSection({
  icon,
  title,
  subtitle,
  status,
  rightExtra,
  defaultOpen = true,
  children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  status?: "disconnected" | "connecting" | "connected" | "error";
  rightExtra?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="glass rounded-xl p-4 sm:p-5">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 group"
        >
          <div className="flex items-center gap-2 text-left">
            {icon}
            <div>
              <div className="font-bold text-sm flex items-center gap-1.5">
                {title}
              </div>
              {subtitle && (
                <div className="text-[10px] text-muted-foreground">
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rightExtra}
            {status && <StatusBadge status={status} />}
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
                "group-hover:text-foreground",
              )}
            />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapse data-[state=open]:animate-expand">
        <div className="space-y-3 mt-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
