"use client";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/**
 * Noun-style signal/broadcast mark.
 * Rows light green inside → mid → outer, then reset.
 */
export function SignalPulseIcon({ className }: Props) {
  return (
    <div className={cn("auth-signal", className)} aria-hidden>
      <div className="auth-signal-glow" />
      <svg
        className="auth-signal-svg"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left arcs: outer → mid → inner (row 3, 2, 1) */}
        <path
          className="auth-signal-arc auth-signal-arc--row3"
          d="M28 28c-14 14-14 50 0 64"
          strokeLinecap="round"
        />
        <path
          className="auth-signal-arc auth-signal-arc--row2"
          d="M40 38c-9 9-9 35 0 44"
          strokeLinecap="round"
        />
        <path
          className="auth-signal-arc auth-signal-arc--row1"
          d="M52 48c-4.5 4.5-4.5 19 0 24"
          strokeLinecap="round"
        />

        {/* Right arcs */}
        <path
          className="auth-signal-arc auth-signal-arc--row3"
          d="M92 28c14 14 14 50 0 64"
          strokeLinecap="round"
        />
        <path
          className="auth-signal-arc auth-signal-arc--row2"
          d="M80 38c9 9 9 35 0 44"
          strokeLinecap="round"
        />
        <path
          className="auth-signal-arc auth-signal-arc--row1"
          d="M68 48c4.5 4.5 4.5 19 0 24"
          strokeLinecap="round"
        />
      </svg>
      <p className="auth-signal-caption">Nye firma dukker opp over hele Norge</p>
    </div>
  );
}
