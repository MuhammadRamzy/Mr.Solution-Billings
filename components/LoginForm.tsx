"use client";

import React, { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { loginAction } from "@/app/actions";
import { BusinessProfile } from "@/lib/types";

function LoginInner({ profile }: { profile: BusinessProfile }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Please enter the password");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await loginAction(password);
      if (res.success) {
        router.push(redirectTo);
        router.refresh();
      } else {
        setError(res.error || "Incorrect password");
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-200/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-100/30 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full space-y-6 z-10">
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/5 mb-4 overflow-hidden">
            {profile.logoUrl ? (
              <img src={profile.logoUrl} alt={profile.name} className="h-10 w-auto object-contain" />
            ) : (
              <span className="text-2xl font-black text-indigo-600">{profile.name.charAt(0)}</span>
            )}
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">{profile.name}</h2>
          <p className="mt-1.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">Billing Console</p>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/50 p-6 sm:p-8 shadow-xl shadow-slate-900/5">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900">Sign In</h3>
            <p className="text-xs text-slate-500 mt-1">Enter your password to access the billing dashboard.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-rose-50 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2 border border-rose-100 animate-in fade-in duration-200">
                <AlertCircle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Password</label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isPending}
                  className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder-slate-300 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isPending}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650 disabled:opacity-50"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 active:scale-[0.98] disabled:opacity-60 text-xs cursor-pointer uppercase tracking-wider"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-slate-400 font-medium">Default password is set in Settings after first login.</p>
      </div>
    </div>
  );
}

export default function LoginForm({ profile }: { profile: BusinessProfile }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <LoginInner profile={profile} />
    </Suspense>
  );
}
