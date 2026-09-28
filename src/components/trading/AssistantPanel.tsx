"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot,
  ChevronDown,
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  Send,
  Sparkles,
  TrendingUp,
  Activity,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTradingStore } from "@/lib/store/trading-store";
import { STRATEGIES } from "@/lib/trading/strategies";
import { selectEquity, selectUnrealizedPnl } from "@/lib/store/trading-store";
import type { StrategyId } from "@/lib/trading/types";
import {
  CollapsibleCard,
} from "@/components/trading/CollapsibleCard";

type ModelProvider = "zai" | "openrouter" | "nvidia";

const MODEL_INFO: Record<
  ModelProvider,
  { name: string; short: string; model: string; color: string; description: string }
> = {
  zai: {
    name: "Pulsar AI (Built-in)",
    short: "PULSAR",
    model: "glm-4.6",
    color: "#22d3ee",
    description: "Default — no API key needed. Powered by Z.AI GLM-4.6.",
  },
  openrouter: {
    name: "OpenRouter",
    short: "OPENROUTER",
    model: "anthropic/claude-3.5-sonnet",
    color: "#a78bfa",
    description: "Bring your own OpenRouter key. Routes to Claude, GPT, Llama, etc.",
  },
  nvidia: {
    name: "NVIDIA NIM",
    short: "NVIDIA",
    model: "nvidia/llama-3.1-nemotron-70b",
    color: "#76b900",
    description: "Bring your own NVIDIA API key. Uses Nemotron-70B.",
  },
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: string[];
}

interface AssistantAction {
  type: string;
  payload?: Record<string, unknown>;
}

export function AssistantPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hey! I'm Pulsar AI. I can control the entire app for you — start/stop the engine, change risk settings, toggle strategies, switch views, and more. Just tell me what you need!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelProvider, setModelProvider] = useState<ModelProvider>("zai");
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [nvidiaKey, setNvidiaKey] = useState("");
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [showNvidiaKey, setShowNvidiaKey] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load saved API keys + provider
  useEffect(() => {
    setOpenrouterKey(localStorage.getItem("pulsar_openrouter_key") || "");
    setNvidiaKey(localStorage.getItem("pulsar_nvidia_key") || "");
    const saved = localStorage.getItem("pulsar_model_provider") as ModelProvider | null;
    if (saved) setModelProvider(saved);
  }, []);

  // Save API keys on change
  useEffect(() => {
    if (openrouterKey) localStorage.setItem("pulsar_openrouter_key", openrouterKey);
  }, [openrouterKey]);
  useEffect(() => {
    if (nvidiaKey) localStorage.setItem("pulsar_nvidia_key", nvidiaKey);
  }, [nvidiaKey]);
  useEffect(() => {
    localStorage.setItem("pulsar_model_provider", modelProvider);
  }, [modelProvider]);

  // Store access
  const store = useTradingStore();
  const equity = useTradingStore(selectEquity);
  const unreal = useTradingStore(selectUnrealizedPnl);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const buildAppState = () => {
    const state = useTradingStore.getState();
    const trades = state.trades;
    const wins = trades.filter((t) => t.outcome === "WIN").length;
    const losses = trades.filter((t) => t.outcome === "LOSS").length;

    // Per-strategy performance breakdown
    const stratPerf: Record<string, { w: number; l: number; pnl: number }> = {};
    trades.forEach((t) => {
      if (!stratPerf[t.strategy]) stratPerf[t.strategy] = { w: 0, l: 0, pnl: 0 };
      if (t.outcome === "WIN") stratPerf[t.strategy].w++;
      else if (t.outcome === "LOSS") stratPerf[t.strategy].l++;
      stratPerf[t.strategy].pnl += t.pnl;
    });

    return {
      running: state.running,
      equity,
      realizedPnl: state.realizedPnl,
      unrealizedPnl: unreal,
      startingBalance: state.startingBalance,
      totalReturn: ((equity - state.startingBalance) / state.startingBalance) * 100,
      openPositions: state.positions.length,
      totalTrades: trades.length,
      wins,
      losses,
      winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
      settings: state.settings,
      pairs: state.pairs.map((p) => ({
        symbol: p.symbol,
        enabled: p.enabled,
        strategies: p.strategies,
      })),
      activeView: state.activeView,
      strategies: Object.values(STRATEGIES).map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
      })),
      lossStreaks: state.lossStreaks,
      autoDisabled: state.autoDisabled,
    };
  };

  const executeAction = (action: AssistantAction) => {
    const { type, payload } = action;
    try {
      switch (type) {
        case "startEngine":
          store.startEngine();
          break;
        case "stopEngine":
          store.stopEngine();
          break;
        case "resetEngine":
          store.resetEngine();
          break;
        case "setView":
          if (payload?.view) store.setActiveView(payload.view as "dashboard" | "backtest" | "strategies" | "live" | "risk" | "assistant");
          break;
        case "updateSettings":
          if (payload) store.updateSettings(payload as any);
          break;
        case "setTickMs":
          if (payload?.ms) store.setTickMs(payload.ms as number);
          break;
        case "togglePair":
          if (payload?.symbol) store.togglePair(payload.symbol as string);
          break;
        case "toggleStrategy":
          if (payload?.strategy)
            store.setStrategyGloballyEnabled(payload.strategy as StrategyId, !store.isStrategyGloballyEnabled(payload.strategy as StrategyId));
          break;
        case "closeAllPositions":
          store.closeAllPositions();
          break;
        case "clearHistory":
          store.clearHistory();
          break;
        case "runBacktests":
          store.runBacktests();
          break;
        case "resetLossStreak":
          if (payload?.strategy) store.resetLossStreak(payload.strategy as StrategyId);
          break;
      }
    } catch (err) {
      console.error("[assistant] Action error:", err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    // Provider readiness check
    if (modelProvider === "openrouter" && !openrouterKey.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "You've selected OpenRouter as the model provider but haven't entered an API key yet. Click the provider pill above to open the settings, paste your OpenRouter key (starts with sk-or-...), and try again. Or switch back to Pulsar AI (Built-in) to use the default model.",
        },
      ]);
      setLoading(false);
      return;
    }
    if (modelProvider === "nvidia" && !nvidiaKey.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "You've selected NVIDIA NIM as the model provider but haven't entered an API key yet. Click the provider pill above to open the settings, paste your NVIDIA key (starts with nvapi-...), and try again. Or switch back to Pulsar AI (Built-in) to use the default model.",
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          appState: buildAppState(),
          modelProvider,
          openrouterKey: openrouterKey || undefined,
          nvidiaKey: nvidiaKey || undefined,
        }),
      });
      const data = await res.json();

      // Execute any actions
      if (data.actions && Array.isArray(data.actions)) {
        data.actions.forEach((action: AssistantAction) => executeAction(action));
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message,
          actions: data.actions?.map((a: AssistantAction) => a.type),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't reach the server. Please try again. If you're using a custom provider (OpenRouter/NVIDIA), verify your API key is correct.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: "How's the app doing?", icon: <TrendingUp className="w-3 h-3" /> },
    { label: "Start the engine", icon: <Zap className="w-3 h-3" /> },
    { label: "Set risk to 1%", icon: <Activity className="w-3 h-3" /> },
    { label: "Go to backtest", icon: <Sparkles className="w-3 h-3" /> },
  ];

  const currentModel = MODEL_INFO[modelProvider];

  return (
    <div className="flex flex-col h-full glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-emerald-400 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-black" strokeWidth={2.5} />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0a0e1a]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm flex items-center gap-1.5">
            Pulsar AI
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              ASSISTANT
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Can control the entire app via chat
          </div>
        </div>
        {/* Provider selector pill — click to expand settings */}
        <button
          onClick={() => setShowModelSettings(!showModelSettings)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 border border-white/10 hover:bg-white/10 transition flex-shrink-0"
          style={{ color: currentModel.color }}
          title="Switch AI model provider"
        >
          <Cpu className="w-3 h-3" />
          <span className="font-semibold">{currentModel.short}</span>
          <ChevronDown
            className={cn(
              "w-3 h-3 transition-transform",
              showModelSettings && "rotate-180",
            )}
          />
        </button>
      </div>

      {/* Model provider settings — collapsible */}
      {showModelSettings && (
        <div className="px-4 py-3 border-b border-white/5 space-y-3 bg-white/[0.02]">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            AI Model Provider
          </div>
          {/* Provider tabs — 3 prominent buttons */}
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(MODEL_INFO) as ModelProvider[]).map((p) => {
              const info = MODEL_INFO[p];
              const active = modelProvider === p;
              return (
                <button
                  key={p}
                  onClick={() => setModelProvider(p)}
                  className={cn(
                    "flex flex-col items-start gap-1 px-2.5 py-2 rounded-lg text-left border transition",
                    active
                      ? "bg-white/10 border-white/20"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/5",
                  )}
                  style={active ? { borderColor: info.color + "60" } : {}}
                >
                  <div
                    className="flex items-center gap-1.5"
                    style={{ color: info.color }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: info.color,
                        opacity: active ? 1 : 0.4,
                      }}
                    />
                    <span className="text-[10px] font-bold tracking-wider">
                      {info.short}
                    </span>
                  </div>
                  <div className="text-[9px] text-muted-foreground leading-tight">
                    {info.name}
                  </div>
                </button>
              );
            })}
          </div>
          {/* Description + model name */}
          <div className="text-[10px] text-muted-foreground leading-relaxed">
            {currentModel.description}
          </div>
          <div className="text-[9px] text-white/40 font-mono">
            Model: <span style={{ color: currentModel.color }}>{currentModel.model}</span>
          </div>

          {/* API key inputs — only show for providers that need them */}
          {modelProvider === "openrouter" && (
            <div>
              <Label className="text-[10px] text-muted-foreground">
                OpenRouter API Key
              </Label>
              <div className="relative mt-1">
                <Input
                  type={showOpenrouterKey ? "text" : "password"}
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="font-mono text-xs bg-white/5 border-white/10 pr-9"
                />
                <button
                  onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showOpenrouterKey ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="text-[9px] text-muted-foreground mt-1.5">
                Get a key at{" "}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 hover:underline"
                >
                  openrouter.ai/keys
                </a>{" "}
                · stored locally in your browser only
              </div>
            </div>
          )}
          {modelProvider === "nvidia" && (
            <div>
              <Label className="text-[10px] text-muted-foreground">
                NVIDIA API Key
              </Label>
              <div className="relative mt-1">
                <Input
                  type={showNvidiaKey ? "text" : "password"}
                  value={nvidiaKey}
                  onChange={(e) => setNvidiaKey(e.target.value)}
                  placeholder="nvapi-..."
                  className="font-mono text-xs bg-white/5 border-white/10 pr-9"
                />
                <button
                  onClick={() => setShowNvidiaKey(!showNvidiaKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNvidiaKey ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="text-[9px] text-muted-foreground mt-1.5">
                Get a key at{" "}
                <a
                  href="https://build.nvidia.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 hover:underline"
                >
                  build.nvidia.com
                </a>{" "}
                · stored locally in your browser only
              </div>
            </div>
          )}
          {modelProvider === "zai" && (
            <div className="text-[10px] text-muted-foreground bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-2.5">
              ✓ No API key required. Pulsar AI uses the built-in GLM-4.6 model — just type and send.
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3 min-h-[300px]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2.5",
              msg.role === "user" ? "flex-row-reverse" : "",
            )}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-black" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-cyan-500/20 text-cyan-100 rounded-tr-sm"
                  : "bg-white/[0.04] text-white/80 rounded-tl-sm",
              )}
            >
              {msg.content}
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {msg.actions.map((a, j) => (
                    <span
                      key={j}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono"
                    >
                      ⚡ {a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-black" />
            </div>
            <div className="bg-white/[0.04] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
              <span className="text-[11px] text-muted-foreground">
                {currentModel.short} is thinking…
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              onClick={() => setInput(qa.label)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition"
            >
              {qa.icon}
              {qa.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={`Ask ${currentModel.short} to control the app…`}
            disabled={loading}
            className="bg-white/[0.03] border-white/10 text-sm"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
