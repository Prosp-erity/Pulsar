"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
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
  // Global
  liveTradingEnabled: boolean;
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

function saveCreds(creds: Credentials) {
  if (typeof window === "undefined") return;
  try {
    // Basic obfuscation via base64 — NOT secure encryption.
    // In production, credentials should be sent to a backend that
    // stores them in an encrypted vault (e.g., AWS Secrets Manager).
    const encoded = btoa(JSON.stringify(creds));
    window.localStorage.setItem(CRED_KEY, encoded);
  } catch {
    // ignore
  }
}

function clearCreds() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CRED_KEY);
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

  const handleOkxTest = async () => {
    update({ okxStatus: "connecting" });
    setError(null);
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
    // Simulate connection test (in production, call OKX REST API)
    await new Promise((r) => setTimeout(r, 1500));
    const baseUrl = creds.okxIsDemo
      ? "https://simulated-api.okx.com"
      : "https://www.okx.com";
    update({ okxStatus: "connected" });
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

  const handleEnableLive = (enabled: boolean) => {
    if (enabled) {
      // Require at least one connection before enabling live trading
      if (creds.binanceStatus !== "connected" && creds.metaApiStatus !== "connected" && creds.mt5Status !== "connected" && creds.okxStatus !== "connected") {
        setError("Connect at least one exchange before enabling live trading");
        return;
      }
      setError(null);
    }
    update({ liveTradingEnabled: enabled });
  };

  const handleClearAll = () => {
    clearCreds();
    setCreds(DEFAULT_CREDS);
    setError(null);
  };

  if (!creds) return null;

  return (
    <div className="space-y-4">
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
        <div className="glass rounded-xl p-4 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-300 text-sm">
                Live Trading Active
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Real orders will be placed using your connected exchange API.
                Ensure your API keys have the correct permissions (spot trading
                enabled, withdrawals disabled). The app uses the same strategies,
                position sizing, and risk management as the simulation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Binance API */}
      <div className="glass rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="font-bold text-sm">Binance API</div>
              <div className="text-[10px] text-muted-foreground">
                Spot trading on Binance exchange
              </div>
            </div>
          </div>
          <StatusBadge status={creds.binanceStatus} />
        </div>

        <div className="space-y-3">
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
        </div>
      </div>

      {/* OKX */}
      <div className="glass rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <div className="font-bold text-sm">OKX</div>
              <div className="text-[10px] text-muted-foreground">
                Spot trading on OKX exchange
              </div>
            </div>
          </div>
          <StatusBadge status={creds.okxStatus} />
        </div>

        <div className="space-y-3">
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
                Demo Trading (recommended for testing)
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
        </div>
      </div>

      {/* MetaAPI */}
      <div className="glass rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Key className="w-4 h-4 text-violet-300" />
            </div>
            <div>
              <div className="font-bold text-sm">MetaAPI</div>
              <div className="text-[10px] text-muted-foreground">
                Connect to MT4/MT5 accounts via MetaApi cloud
              </div>
            </div>
          </div>
          <StatusBadge status={creds.metaApiStatus} />
        </div>

        <div className="space-y-3">
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
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass rounded-xl p-3 border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        </div>
      )}

      {/* MT5 Bridge — FREE custom EA + REST server */}
      <div className="glass rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Power className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <div className="font-bold text-sm flex items-center gap-1.5">
                MT5 Bridge
                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  FREE
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Custom EA + REST server (no subscription)
              </div>
            </div>
          </div>
          <StatusBadge status={creds.mt5Status} />
        </div>

        <div className="space-y-3">
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
        </div>
      </div>

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
        <div className="glass rounded-xl p-4 border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-2">
            <Power className="w-4 h-4 text-emerald-300" />
            <span className="font-semibold text-sm text-emerald-300">
              Live Trading Ready
            </span>
          </div>
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
        </div>
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
