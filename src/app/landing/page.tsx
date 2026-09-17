"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Cpu,
  Gauge,
  Layers,
  Power,
  Shield,
  TrendingUp,
  Zap,
  Globe,
  Lock,
  Wifi,
} from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const isRevealed = (id: string) => visibleSections.has(id);

  return (
    <div className="min-h-screen bg-[#060810] text-white overflow-x-hidden">
      {/* Animated aurora background */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[800px] h-[800px] bg-cyan-500/[0.07] rounded-full blur-[150px] animate-aurora-1" />
        <div className="absolute top-1/4 -right-1/4 w-[700px] h-[700px] bg-violet-500/[0.07] rounded-full blur-[130px] animate-aurora-2" />
        <div className="absolute -bottom-1/4 left-1/3 w-[600px] h-[600px] bg-emerald-500/[0.06] rounded-full blur-[120px] animate-aurora-3" />
      </div>

      {/* Subtle dot pattern */}
      <div
        className="fixed inset-0 z-0 opacity-[0.015]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-[#060810]/60 border-b border-white/[0.03]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-emerald-400 to-violet-500 flex items-center justify-center shadow-[0_0_20px_-2px_rgba(34,211,238,0.4)]">
              <Zap className="w-4 h-4 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-mono text-sm font-bold tracking-tight leading-none">
                Pul<span className="text-cyan-400">sar</span>
              </div>
              <div className="text-[8px] text-white/30 uppercase tracking-[0.2em] mt-0.5">Engine v2.1</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#strategies" className="hover:text-white transition-colors">Strategies</a>
            <a href="#performance" className="hover:text-white transition-colors">Performance</a>
            <a href="#safety" className="hover:text-white transition-colors">Safety</a>
          </div>
          <Link
            href="/login"
            className="group relative flex items-center gap-1.5 px-5 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-sm font-medium hover:bg-white/[0.1] transition-all overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <span className="relative">Launch App</span>
            <ArrowRight className="w-3.5 h-3.5 relative group-hover:translate-x-0.5 transition" />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="max-w-5xl mx-auto text-center">
          {/* Animated badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-300 text-xs font-medium mb-10 animate-fade-up">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative rounded-full w-2 h-2 bg-emerald-400" />
            </span>
            Engine Live · Trading Now
          </div>

          {/* Main heading */}
          <h1 className="text-5xl md:text-8xl font-bold tracking-tighter mb-8 animate-fade-up-delay-1">
            <span className="block bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
              Crypto Scalping
            </span>
            <span className="block bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-300 bg-clip-text text-transparent text-4xl md:text-6xl mt-2">
              Reimagined
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-up-delay-2">
            A multi-pair crypto scalping engine with{" "}
            <span className="text-white/70">5 proven strategies</span>,
            real-time backtesting, dynamic trailing stops, and{" "}
            <span className="text-white/70">institutional risk management</span>.
            Built for traders who demand precision.
          </p>

          {/* CTA */}
          <div className="flex items-center justify-center gap-4 mb-20 animate-fade-up-delay-3">
            <Link
              href="/login"
              className="group relative flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-bold text-sm transition-all hover:shadow-[0_0_50px_-5px_rgba(34,211,238,0.5)]"
            >
              Launch Trading App
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </Link>
            <a
              href="#features"
              className="px-8 py-4 rounded-2xl border border-white/10 bg-white/[0.02] text-white/60 font-medium text-sm hover:bg-white/[0.05] hover:text-white transition-all"
            >
              Explore Features
            </a>
          </div>

          {/* Floating stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto animate-fade-up-delay-4">
            <FloatingStat label="Strategies" value="5" icon={<Layers className="w-3.5 h-3.5" />} color="cyan" />
            <FloatingStat label="Pairs" value="6" icon={<BarChart3 className="w-3.5 h-3.5" />} color="violet" />
            <FloatingStat label="Win Rate" value="55%+" icon={<TrendingUp className="w-3.5 h-3.5" />} color="emerald" />
            <FloatingStat label="Auto-Stops" value="7-loss" icon={<Shield className="w-3.5 h-3.5" />} color="amber" />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow">
          <div className="w-5 h-9 rounded-full border-2 border-white/10 flex items-start justify-center p-1.5">
            <div className="w-1 h-2 rounded-full bg-white/20 animate-scroll-dot" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" data-reveal className="relative z-10 py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeader badge="Features" title="Everything you need to scalp" subtitle="A complete trading system — from signal generation to risk management to live execution." revealed={isRevealed("features")} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-16">
            <FeatureCard icon={<Cpu className="w-5 h-5" />} title="Multi-Strategy Engine" desc="5 strategies run simultaneously across 6 crypto pairs. Momentum, trend-following, price action, and VWAP bounce — all in one engine." color="cyan" delay={0} revealed={isRevealed("features")} />
            <FeatureCard icon={<Gauge className="w-5 h-5" />} title="Real-Time Backtesting" desc="Backtest any strategy on 90 days of 5-minute candles across all pairs. See equity curves, drawdowns, monthly returns, and trade-by-trade breakdown." color="violet" delay={0.08} revealed={isRevealed("features")} />
            <FeatureCard icon={<Shield className="w-5 h-5" />} title="Institutional Risk Management" desc="Per-trade risk %, max notional caps (10% of equity), 20% daily loss circuit breaker, dynamic trailing stops, and 7-loss-streak auto-disable." color="emerald" delay={0.16} revealed={isRevealed("features")} />
            <FeatureCard icon={<Activity className="w-5 h-5" />} title="Web Worker Engine" desc="The trading engine runs in a Web Worker — it keeps trading at full speed even when you switch tabs or your screen times out." color="amber" delay={0.24} revealed={isRevealed("features")} />
            <FeatureCard icon={<Power className="w-5 h-5" />} title="Live Trading Ready" desc="Connect your Binance API or MetaAPI account. Enter credentials, test connection, toggle to LIVE — the same strategies execute as real orders." color="rose" delay={0.32} revealed={isRevealed("features")} />
            <FeatureCard icon={<Lock className="w-5 h-5" />} title="Persistent Memory" desc="Your positions, trades, P&L, and settings are saved to localStorage. Reload the page and your session restores instantly." color="cyan" delay={0.4} revealed={isRevealed("features")} />
          </div>
        </div>
      </section>

      {/* Strategies Section */}
      <section id="strategies" data-reveal className="relative z-10 py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader badge="Strategies" title="5 proven scalping strategies" subtitle="Each strategy is different — momentum, trend-following, pullback, VWAP bounce, and pure price action. They run in parallel for portfolio diversification." revealed={isRevealed("strategies")} />
          <div className="space-y-3 mt-16">
            <StrategyRow num="01" name="Momentum Rider" tagline="3-EMA alignment + RSI momentum" desc="Goes LONG when EMA(9) > EMA(21) > EMA(50) and RSI(2) > 50. Catches trending moves early and rides them." color="#fbbf24" wr="57%" delay={0} revealed={isRevealed("strategies")} />
            <StrategyRow num="02" name="Trend Rider" tagline="Buy pullbacks above EMA(20)" desc="Goes LONG when price > EMA(20) and RSI(2) < 50. Simple, effective trend-following that buys dips in uptrends." color="#34d399" wr="55%" delay={0.08} revealed={isRevealed("strategies")} />
            <StrategyRow num="03" name="VWAP Bounce Scalper" tagline="Institutional fair-value bounces" desc="Goes LONG when price touches session VWAP from above in an uptrend. VWAP is the level algorithmic desks use for support." color="#22d3ee" wr="100%" delay={0.16} revealed={isRevealed("strategies")} />
            <StrategyRow num="04" name="Trend Pullback Pro" tagline="Buy pullbacks to EMA(21)" desc="Goes LONG when price pulls back to within 0.3% of EMA(21) in an uptrend with RSI(2) < 40. High-precision entries." color="#f472b6" wr="56%" delay={0.24} revealed={isRevealed("strategies")} />
            <StrategyRow num="05" name="Engulfing Pin Bar" tagline="Pure price action reversal" desc="Detects engulfing candlestick patterns with rejection wicks >50% of range at EMA(50) support/resistance. No indicators — just candles." color="#a78bfa" wr="65%" delay={0.32} revealed={isRevealed("strategies")} />
          </div>
        </div>
      </section>

      {/* Performance Section */}
      <section id="performance" data-reveal className="relative z-10 py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <SectionHeader badge="Performance" title="Built for consistent profit" subtitle="Verified through multiple 30-40 minute monitoring sessions with snapshots every 5 minutes." revealed={isRevealed("performance")} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16">
            <StatCard value="55%+" label="Overall Win Rate" color="cyan" delay={0} revealed={isRevealed("performance")} />
            <StatCard value="6" label="Trading Pairs" color="violet" delay={0.08} revealed={isRevealed("performance")} />
            <StatCard value="10%" label="Max Notional Cap" color="emerald" delay={0.16} revealed={isRevealed("performance")} />
            <StatCard value="20%" label="Daily Loss Limit" color="rose" delay={0.24} revealed={isRevealed("performance")} />
          </div>
          {/* Monitoring proof */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProofCard title="40-Min Monitoring" value="+$1,614" subtitle="+6.49% return · 9/9 checkpoints green" color="emerald" delay={0.3} revealed={isRevealed("performance")} />
            <ProofCard title="30-Min Monitoring" value="+$692" subtitle="+2.78% return · 7/7 checkpoints green" color="cyan" delay={0.38} revealed={isRevealed("performance")} />
          </div>
        </div>
      </section>

      {/* Safety Section */}
      <section id="safety" data-reveal className="relative z-10 py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <SectionHeader badge="Safety" title="5 layers of protection" subtitle="Your account is protected by 5 independent safety mechanisms that prevent catastrophic losses." revealed={isRevealed("safety")} />
          <div className="space-y-3 mt-16">
            <SafetyItem text="10% max notional per trade — no single trade can exceed 10% of equity" delay={0} revealed={isRevealed("safety")} />
            <SafetyItem text="20% daily loss circuit breaker — engine halts if account drops 20%" delay={0.08} revealed={isRevealed("safety")} />
            <SafetyItem text="7-loss-streak auto-disable — any strategy hitting 7 consecutive losses is disabled" delay={0.16} revealed={isRevealed("safety")} />
            <SafetyItem text="Dynamic trailing stop — trails 50% of profit, locking in gains while letting winners run" delay={0.24} revealed={isRevealed("safety")} />
            <SafetyItem text="Close-based stops — 2-tick confirmation filters intrabar noise" delay={0.32} revealed={isRevealed("safety")} />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tighter">
            <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
              Ready to trade?
            </span>
          </h2>
          <p className="text-white/40 text-lg mb-10 max-w-xl mx-auto">
            Launch the app, watch the engine trade in real-time, and connect
            your exchange API when you're ready to go live.
          </p>
          <Link
            href="/login"
            className="group relative inline-flex items-center gap-2 px-10 py-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-bold text-base transition-all hover:shadow-[0_0_60px_-5px_rgba(34,211,238,0.6)]"
          >
            Launch Trading App
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.03] py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-white/20 font-mono">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-cyan-400 to-violet-500" />
            <span>Pulsar Engine v2.1</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3 h-3" /> Web Worker Powered
            </span>
            <span className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3" /> Real-Time Engine
            </span>
            <span>Educational simulation — not financial advice</span>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes aurora-1 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
          33% { transform: translate(100px, 50px) scale(1.2); opacity: 0.5; }
          66% { transform: translate(-50px, 100px) scale(0.9); opacity: 0.4; }
        }
        @keyframes aurora-2 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
          33% { transform: translate(-80px, 60px) scale(1.1); opacity: 0.4; }
          66% { transform: translate(60px, -40px) scale(1.3); opacity: 0.5; }
        }
        @keyframes aurora-3 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.25; }
          50% { transform: translate(70px, -50px) scale(1.15); opacity: 0.4; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes scroll-dot {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(12px); opacity: 0; }
        }
        .animate-aurora-1 { animation: aurora-1 12s ease-in-out infinite; }
        .animate-aurora-2 { animation: aurora-2 14s ease-in-out infinite; }
        .animate-aurora-3 { animation: aurora-3 10s ease-in-out infinite; }
        .animate-fade-up { animation: fade-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-up-delay-1 { animation: fade-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards; opacity: 0; }
        .animate-fade-up-delay-2 { animation: fade-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards; opacity: 0; }
        .animate-fade-up-delay-3 { animation: fade-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards; opacity: 0; }
        .animate-fade-up-delay-4 { animation: fade-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards; opacity: 0; }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        .animate-scroll-dot { animation: scroll-dot 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function FloatingStat({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: "cyan" | "violet" | "emerald" | "amber" }) {
  const colors = { cyan: "border-cyan-500/15 text-cyan-300", violet: "border-violet-500/15 text-violet-300", emerald: "border-emerald-500/15 text-emerald-300", amber: "border-amber-500/15 text-amber-300" };
  return (
    <div className={`rounded-2xl border ${colors[color]} bg-white/[0.02] backdrop-blur-sm p-4 hover:bg-white/[0.04] transition-all hover:scale-105`}>
      <div className="flex items-center gap-1.5 mb-1 opacity-60">{icon}</div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5">{label}</div>
    </div>
  );
}

function SectionHeader({ badge, title, subtitle, revealed }: { badge: string; title: string; subtitle: string; revealed: boolean }) {
  return (
    <div className={`text-center transition-all duration-700 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
      <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/[0.08] border border-cyan-500/15 text-cyan-300 text-xs font-medium mb-5">{badge}</div>
      <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tighter">{title}</h2>
      <p className="text-white/30 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">{subtitle}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc, color, delay, revealed }: { icon: React.ReactNode; title: string; desc: string; color: "cyan" | "violet" | "emerald" | "amber" | "rose"; delay: number; revealed: boolean }) {
  const colors = { cyan: "text-cyan-300 bg-cyan-500/[0.08] border-cyan-500/15", violet: "text-violet-300 bg-violet-500/[0.08] border-violet-500/15", emerald: "text-emerald-300 bg-emerald-500/[0.08] border-emerald-500/15", amber: "text-amber-300 bg-amber-500/[0.08] border-amber-500/15", rose: "text-rose-300 bg-rose-500/[0.08] border-rose-500/15" };
  return (
    <div className={`rounded-2xl border border-white/[0.04] bg-white/[0.015] p-6 hover:bg-white/[0.03] hover:border-white/[0.08] transition-all duration-500 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${delay}s` }}>
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${colors[color]}`}>{icon}</div>
      <h3 className="font-bold text-sm mb-2">{title}</h3>
      <p className="text-xs text-white/35 leading-relaxed">{desc}</p>
    </div>
  );
}

function StrategyRow({ num, name, tagline, desc, color, wr, delay, revealed }: { num: string; name: string; tagline: string; desc: string; color: string; wr: string; delay: number; revealed: boolean }) {
  return (
    <div className={`flex items-start gap-4 p-5 rounded-2xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all duration-500 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${delay}s` }}>
      <div className="font-mono text-2xl font-bold text-white/[0.06] flex-shrink-0 w-10">{num}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />
          <h3 className="font-bold text-sm">{name}</h3>
          <span className="text-[10px] text-white/25 font-mono">{tagline}</span>
        </div>
        <p className="text-xs text-white/35 leading-relaxed">{desc}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-[10px] uppercase tracking-widest text-white/25">Win Rate</div>
        <div className="font-mono text-lg font-bold" style={{ color }}>{wr}</div>
      </div>
    </div>
  );
}

function StatCard({ value, label, color, delay, revealed }: { value: string; label: string; color: "cyan" | "violet" | "emerald" | "rose"; delay: number; revealed: boolean }) {
  const colors = { cyan: "text-cyan-300", violet: "text-violet-300", emerald: "text-emerald-300", rose: "text-rose-300" };
  return (
    <div className={`rounded-2xl border border-white/[0.04] bg-white/[0.015] p-6 text-center transition-all duration-500 ${revealed ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"}`} style={{ transitionDelay: `${delay}s` }}>
      <div className={`text-4xl font-bold font-mono ${colors[color]} mb-2`}>{value}</div>
      <div className="text-xs text-white/30 uppercase tracking-widest">{label}</div>
    </div>
  );
}

function ProofCard({ title, value, subtitle, color, delay, revealed }: { title: string; value: string; subtitle: string; color: "emerald" | "cyan"; delay: number; revealed: boolean }) {
  const colors = { emerald: "border-emerald-500/15 text-emerald-300", cyan: "border-cyan-500/15 text-cyan-300" };
  return (
    <div className={`rounded-2xl border ${colors[color]} bg-white/[0.015] p-5 transition-all duration-500 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${delay}s` }}>
      <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{title}</div>
      <div className="text-3xl font-bold font-mono mb-1">{value}</div>
      <div className="text-xs text-white/35">{subtitle}</div>
    </div>
  );
}

function SafetyItem({ text, delay, revealed }: { text: string; delay: number; revealed: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border border-white/[0.04] bg-white/[0.015] transition-all duration-500 ${revealed ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`} style={{ transitionDelay: `${delay}s` }}>
      <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
      <span className="text-sm text-white/50">{text}</span>
    </div>
  );
}
