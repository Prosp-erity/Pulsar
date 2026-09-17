"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  User,
  Zap,
  Loader2,
  Shield,
  Activity,
} from "lucide-react";
import Link from "next/link";

// Credentials (in production these would be verified server-side)
const VALID_USERNAME = "King";
const VALID_PASSWORD = "Baron6031?";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  // Check if already logged in
  useEffect(() => {
    const authed = typeof window !== "undefined" && sessionStorage.getItem("pulsar_auth") === "true";
    if (authed) {
      router.push("/");
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Simulate auth delay for UX
    setTimeout(() => {
      if (username === VALID_USERNAME && password === VALID_PASSWORD) {
        sessionStorage.setItem("pulsar_auth", "true");
        localStorage.setItem("pulsar_auth", "true");
        setAuthSuccess(true);
        setTimeout(() => {
          router.push("/");
        }, 1000);
      } else {
        setError("Invalid credentials. Please try again.");
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#060810] text-white flex items-center justify-center px-6 relative overflow-hidden">
      {/* Animated aurora background */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[800px] h-[800px] bg-cyan-500/[0.08] rounded-full blur-[150px] animate-aurora-1" />
        <div className="absolute top-1/4 -right-1/4 w-[700px] h-[700px] bg-violet-500/[0.08] rounded-full blur-[130px] animate-aurora-2" />
        <div className="absolute -bottom-1/4 left-1/3 w-[600px] h-[600px] bg-emerald-500/[0.06] rounded-full blur-[120px] animate-aurora-3" />
      </div>

      {/* Dot pattern */}
      <div
        className="fixed inset-0 z-0 opacity-[0.015]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Back to landing */}
      <Link
        href="/landing"
        className="absolute top-6 left-6 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white/50 hover:text-white hover:bg-white/[0.06] transition z-10"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Landing Page
      </Link>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 via-emerald-400 to-violet-500 shadow-[0_0_40px_-5px_rgba(34,211,238,0.5)] mb-4">
            {authSuccess ? (
              <Shield className="w-7 h-7 text-black" strokeWidth={2.5} />
            ) : (
              <Zap className="w-7 h-7 text-black" strokeWidth={2.5} />
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tighter mb-1">
            Pul<span className="text-cyan-400">sar</span>
          </h1>
          <p className="text-xs text-white/30 uppercase tracking-[0.3em]">
            Crypto Scalping Engine
          </p>
        </div>

        {/* Auth success state */}
        {authSuccess ? (
          <div className="glass rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-4 animate-fade-in-up">
              <Shield className="w-8 h-8 text-emerald-300" />
            </div>
            <h2 className="text-xl font-bold text-emerald-300 mb-2">Access Granted</h2>
            <p className="text-sm text-white/40 mb-4">Launching trading dashboard...</p>
            <div className="flex justify-center">
              <Loader2 className="w-5 h-5 text-cyan-300 animate-spin" />
            </div>
          </div>
        ) : (
          /* Login form */
          <form onSubmit={handleLogin} className="glass rounded-2xl p-8 space-y-5">
            {/* Username */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5 block">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoFocus
                  className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm font-mono focus:outline-none focus:border-cyan-500/30 focus:bg-white/[0.05] transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm font-mono focus:outline-none focus:border-cyan-500/30 focus:bg-white/[0.05] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 animate-fade-in-up">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-bold text-sm transition-all hover:shadow-[0_0_30px_-5px_rgba(34,211,238,0.5)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Enter Dashboard
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Security note */}
            <div className="flex items-center justify-center gap-2 text-[10px] text-white/20">
              <Shield className="w-3 h-3" />
              <span>Secured session · Auto-expires on browser close</span>
            </div>
          </form>
        )}

        {/* Feature badges */}
        <div className="flex items-center justify-center gap-6 mt-8 text-[10px] text-white/20">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3" />
            <span>5 Strategies</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3" />
            <span>24/7 Engine</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            <span>Risk Protected</span>
          </div>
        </div>
      </div>

      <style jsx>{`
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
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-aurora-1 { animation: aurora-1 12s ease-in-out infinite; }
        .animate-aurora-2 { animation: aurora-2 14s ease-in-out infinite; }
        .animate-aurora-3 { animation: aurora-3 10s ease-in-out infinite; }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out; }
      `}</style>
    </div>
  );
}
