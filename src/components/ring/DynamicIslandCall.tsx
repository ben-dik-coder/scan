"use client";

import { useEffect, useMemo, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

type CallPhase = "queued" | "ringing" | "in_progress" | "ended" | "failed" | string;

type DynamicIslandCallProps = {
  phase: CallPhase;
  companyName: string;
  statusLabel: string;
  onHangUp?: () => void;
  hangingUp?: boolean;
  className?: string;
};

const BAR_COUNT = 5;

/**
 * iPhone Dynamic Island–style live call pill with animated audio bars.
 * Visual only (no mic) — bars react to call phase.
 */
export function DynamicIslandCall({
  phase,
  companyName,
  statusLabel,
  onHangUp,
  hangingUp,
  className,
}: DynamicIslandCallProps) {
  const active = phase === "queued" || phase === "ringing" || phase === "in_progress";
  const talking = phase === "in_progress";
  const ringing = phase === "ringing" || phase === "queued";

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), talking ? 90 : 160);
    return () => window.clearInterval(id);
  }, [active, talking]);

  const heights = useMemo(() => {
    // Deterministic-ish wave from tick so SSR/hydration stay calm
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      if (!active) return 0.22;
      if (ringing) {
        const pulse = 0.35 + 0.35 * Math.abs(Math.sin((tick + i * 2) * 0.35));
        return pulse;
      }
      // in_progress — more lively, center bars taller
      const center = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / 3;
      const wave =
        0.28 +
        center * 0.55 * (0.45 + 0.55 * Math.abs(Math.sin(tick * 0.55 + i * 0.9)));
      return Math.min(1, wave);
    });
  }, [tick, active, ringing]);

  if (!active) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto z-40 flex justify-center",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={`${statusLabel}: ${companyName}`}
    >
      <div
        className={cn(
          "group relative flex items-center gap-3 overflow-hidden rounded-full",
          "bg-black text-white shadow-[0_8px_40px_rgba(0,0,0,0.55)]",
          "ring-1 ring-white/10",
          "pl-3.5 pr-2 py-2",
          "transition-[width,box-shadow] duration-500 ease-out",
          talking && "shadow-[0_8px_48px_rgba(16,185,129,0.25)] ring-emerald-400/20"
        )}
      >
        {/* Soft inner glow */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full opacity-60",
            talking
              ? "bg-[radial-gradient(120%_80%_at_20%_50%,rgba(16,185,129,0.18),transparent_55%)]"
              : "bg-[radial-gradient(120%_80%_at_20%_50%,rgba(255,255,255,0.08),transparent_55%)]"
          )}
        />

        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
          <Phone
            className={cn(
              "h-3.5 w-3.5",
              talking ? "text-emerald-300" : "text-white/80",
              ringing && "animate-pulse"
            )}
          />
        </div>

        <div className="relative min-w-0 max-w-[9.5rem] sm:max-w-[12rem]">
          <p className="truncate text-[11px] font-semibold leading-tight tracking-tight text-white">
            {companyName}
          </p>
          <p
            className={cn(
              "truncate text-[10px] font-medium leading-tight",
              talking ? "text-emerald-300/90" : "text-white/50"
            )}
          >
            {statusLabel}
          </p>
        </div>

        {/* Waveform */}
        <div
          className="relative ml-0.5 flex h-7 items-center gap-[3px] px-1"
          aria-hidden
        >
          {heights.map((h, i) => (
            <span
              key={i}
              className={cn(
                "w-[3px] rounded-full transition-[height,background-color] duration-75 ease-out",
                talking ? "bg-emerald-300" : "bg-white/70"
              )}
              style={{
                height: `${Math.round(6 + h * 18)}px`,
              }}
            />
          ))}
        </div>

        {onHangUp ? (
          <button
            type="button"
            onClick={onHangUp}
            disabled={hangingUp}
            className={cn(
              "relative ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              "bg-red-500 text-white transition hover:bg-red-400",
              "disabled:opacity-50"
            )}
            aria-label="Legg på"
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Compact inline bars for badges / small chips */
export function CallWaveMini({
  active,
  talking,
  className,
}: {
  active: boolean;
  talking?: boolean;
  className?: string;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), talking ? 90 : 180);
    return () => window.clearInterval(id);
  }, [active, talking]);

  if (!active) return null;

  return (
    <span className={cn("inline-flex h-3 items-end gap-[2px]", className)} aria-hidden>
      {[0, 1, 2, 3].map((i) => {
        const h =
          0.35 +
          0.65 *
            Math.abs(Math.sin(tick * (talking ? 0.6 : 0.35) + i * 0.85));
        return (
          <span
            key={i}
            className={cn(
              "w-[2px] rounded-full",
              talking ? "bg-emerald-300" : "bg-current opacity-80"
            )}
            style={{ height: `${Math.round(4 + h * 8)}px` }}
          />
        );
      })}
    </span>
  );
}
