"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function VistaEarningsPanel({
  vistaState,
  userWallet,
  totalEarned = 0,
  validSeconds = 0,
  isTracking = false,
}) {
  const {
    earnings = totalEarned,
    validSeconds: vistaValidSeconds = validSeconds,
    score = 0,
    isActive = isTracking,
    flagged = false,
    tickAmount = 0,
  } = vistaState ?? {};

  const [displaySeconds, setDisplaySeconds] = useState(vistaValidSeconds);
  const [flash, setFlash] = useState(false);
  const finalEarnings = earnings || totalEarned;

  useEffect(() => {
    setDisplaySeconds(vistaValidSeconds || validSeconds);
  }, [vistaValidSeconds, validSeconds]);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setDisplaySeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  useEffect(() => {
    if (tickAmount === 0) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(t);
  }, [tickAmount]);

  if (!userWallet) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0b0b0f] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <p className="text-sm font-semibold text-zinc-300">✦ VISTA Earnings</p>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Earn USDC from ads while reading. Connect your wallet to start.
        </p>
        <Link
          href="/auth"
          className="inline-flex w-full items-center justify-center rounded-xl bg-linear-to-br from-green-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition"
        >
          Connect Wallet
        </Link>
      </div>
    );
  }

  if (finalEarnings === 0 && !isActive) return null;

  return (
    <div
      className={`rounded-2xl border bg-[#0b0b0f] p-4 space-y-4 transition-colors duration-300 ${
        flash ? "border-green-500/60" : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {isActive && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isActive ? "bg-green-500" : "bg-zinc-600"
              }`}
            />
          </span>
          <p className="text-sm font-semibold text-zinc-300">✦ VISTA Earnings</p>
        </div>
        {flagged && (
          <span className="text-xs text-amber-400 border border-amber-400/30 rounded-full px-2 py-0.5">
            Reviewing
          </span>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-green-400">Session Earnings</p>
        <p
          className={`mt-1 text-2xl font-semibold font-mono transition-colors duration-300 ${
            flash ? "text-green-300" : "text-white"
          }`}
        >
          {typeof finalEarnings === "number"
            ? finalEarnings.toFixed(6)
            : "0.000000"}{" "}
          <span className="text-sm text-zinc-400">USDC</span>
        </p>
      </div>

      {isActive && (
        <div className="border-t border-white/5 pt-3 text-xs text-zinc-400">
          <p className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            Attention verified • {displaySeconds}s tracked
          </p>
        </div>
      )}
    </div>
  );
}
