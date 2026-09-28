"use client";

import { Zap } from "lucide-react";

/**
 * Branded splash screen shown while the app checks authentication state
 * from localStorage/sessionStorage. Renders both on the server (no flash
 * of unstyled content) and on the client until hydration completes.
 *
 * Pure presentational — no hooks, no state. Just the Pulsar logo with a
 * cyan→emerald→violet gradient, animated concentric rings, and the
 * loading text.
 */
export function AuthSplash({ message = "Authenticating" }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#060810] text-white relative overflow-hidden">
      {/* Animated background gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full bg-cyan-500/10 blur-[120px] animate-pulse-dot-slow" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[55vw] h-[55vw] rounded-full bg-violet-500/10 blur-[120px] animate-pulse-dot-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[45vw] h-[45vw] rounded-full bg-emerald-500/10 blur-[100px] animate-pulse-dot-slow" />
      </div>

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-6 z-10">
        {/* Concentric ring animation */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border border-cyan-400/20 animate-ping-slow" />
          {/* Middle ring */}
          <div className="absolute inset-2 rounded-full border border-emerald-400/30 animate-ping-slower" />
          {/* Inner ring */}
          <div className="absolute inset-4 rounded-full border border-violet-400/40 animate-pulse-dot-slow" />
          {/* Center logo */}
          <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 via-emerald-400 to-violet-500 flex items-center justify-center neon-cyan animate-float">
            <Zap className="w-6 h-6 text-black" strokeWidth={2.5} />
          </div>
        </div>

        {/* Brand wordmark */}
        <div className="text-center">
          <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight">
            Pul<span className="text-cyan-400 text-glow">sar</span>
          </div>
          <div className="text-[10px] text-white/40 uppercase tracking-[0.4em] mt-1">
            Scalping Engine
          </div>
        </div>

        {/* Loading indicator */}
        <div className="flex items-center gap-2 text-white/50 text-xs font-mono">
          <span className="flex gap-1">
            <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse-dot" />
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse-dot" style={{ animationDelay: "0.2s" }} />
            <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse-dot" style={{ animationDelay: "0.4s" }} />
          </span>
          <span>{message}…</span>
        </div>
      </div>

      {/* Bottom watermark */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-white/20 font-mono tracking-widest">
        v2.1 · encrypted · low-latency
      </div>
    </div>
  );
}
