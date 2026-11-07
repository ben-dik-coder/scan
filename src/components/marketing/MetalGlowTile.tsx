import { useId } from "react";
import { cn } from "@/lib/utils";

type Mark = "scan" | "enrich" | "voice" | "pipeline" | "inbox" | "ai";
type Tone = "mint" | "sky" | "amber" | "violet";

type Props = {
  mark?: Mark;
  tone?: Tone;
  className?: string;
  size?: "md" | "lg";
};

const TONE_GLASS: Record<Tone, [string, string, string]> = {
  mint: ["#86efac", "#10b981", "#022c22"],
  sky: ["#7dd3fc", "#0ea5e9", "#0c4a6e"],
  amber: ["#fde68a", "#f59e0b", "#451a03"],
  violet: ["#c4b5fd", "#8b5cf6", "#2e1065"],
};

const TONE_POOL: Record<Tone, [string, string, string]> = {
  mint: ["#6ee7b7", "#34d399", "#059669"],
  sky: ["#bae6fd", "#7dd3fc", "#0284c7"],
  amber: ["#fde68a", "#fbbf24", "#d97706"],
  violet: ["#ddd6fe", "#a78bfa", "#7c3aed"],
};

const TONE_RAY: Record<Tone, string> = {
  mint: "#bbf7d0",
  sky: "#bae6fd",
  amber: "#fef3c7",
  violet: "#ddd6fe",
};

/** Resend-style: sandblasted metal plate with a carved-in mark. */
export function MetalGlowTile({
  mark = "scan",
  tone = "mint",
  className,
  size = "lg",
}: Props) {
  const id = useId().replace(/:/g, "");
  const [g0, g1, g2] = TONE_GLASS[tone];
  const [p0, p1, p2] = TONE_POOL[tone];

  return (
    <div
      className={cn(
        "metal-glow-tile",
        `metal-glow-tile--${tone}`,
        size === "md" && "metal-glow-tile--md",
        className,
      )}
      aria-hidden
    >
      <div className="metal-glow-tile-floor" />
      <div className="metal-glow-tile-body">
        <div className="metal-glow-tile-brush" />
        <div className="metal-glow-tile-grain" />
        <div className="metal-glow-tile-spec" />
        <div className="metal-glow-tile-ao" />
        <div className="metal-glow-tile-rim" />
        <div className="metal-glow-tile-lip" />

        <svg
          className="metal-glow-tile-icon"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`${id}-steel`} x1="6" y1="2" x2="58" y2="62">
              <stop stopColor="#8b8b96" />
              <stop offset="0.28" stopColor="#3f3f48" />
              <stop offset="0.55" stopColor="#18181c" />
              <stop offset="0.82" stopColor="#2c2c34" />
              <stop offset="1" stopColor="#5c5c66" />
            </linearGradient>
            <linearGradient id={`${id}-steelHi`} x1="14" y1="6" x2="44" y2="36">
              <stop stopColor="#e4e4e7" stopOpacity="0.65" />
              <stop offset="0.5" stopColor="#a1a1aa" stopOpacity="0.15" />
              <stop offset="1" stopColor="#71717a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${id}-groove`} x1="20" y1="12" x2="44" y2="52">
              <stop stopColor="#000" stopOpacity="0.95" />
              <stop offset="0.5" stopColor="#050507" stopOpacity="0.9" />
              <stop offset="1" stopColor="#0a0a0c" stopOpacity="0.85" />
            </linearGradient>
            <radialGradient id={`${id}-glass`} cx="42%" cy="32%" r="70%">
              <stop stopColor={g0} stopOpacity="0.5" />
              <stop offset="0.4" stopColor={g1} stopOpacity="0.38" />
              <stop offset="1" stopColor={g2} stopOpacity="0.95" />
            </radialGradient>
            <linearGradient id={`${id}-pool`} x1="32" y1="28" x2="32" y2="58">
              <stop stopColor={p0} stopOpacity="0" />
              <stop offset="0.4" stopColor={p1} stopOpacity="0.22" />
              <stop offset="1" stopColor={p2} stopOpacity="0.55" />
            </linearGradient>
            <filter id={`${id}-carve`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="blur" />
              <feOffset dx="0" dy="1.4" result="off" />
              <feComposite in="off" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadowDiff" />
              <feFlood floodColor="#000" floodOpacity="0.85" result="shadowColor" />
              <feComposite in="shadowColor" in2="shadowDiff" operator="in" result="shadow" />
              <feGaussianBlur in="SourceAlpha" stdDeviation="0.7" result="blur2" />
              <feOffset dx="0" dy="-0.8" result="off2" />
              <feComposite in="off2" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="hiDiff" />
              <feFlood floodColor="#fff" floodOpacity="0.28" result="hiColor" />
              <feComposite in="hiColor" in2="hiDiff" operator="in" result="highlight" />
              <feMerge>
                <feMergeNode in="shadow" />
                <feMergeNode in="SourceGraphic" />
                <feMergeNode in="highlight" />
              </feMerge>
            </filter>
            <filter id={`${id}-soft`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>

          <CarvedMark kind={mark} id={id} ray={TONE_RAY[tone]} />
        </svg>
      </div>
    </div>
  );
}

type MarkProps = { kind: Mark; id: string; ray: string };

function CarvedMark({ kind, id, ray }: MarkProps) {
  const steel = `url(#${id}-steel)`;
  const hi = `url(#${id}-steelHi)`;
  const groove = `url(#${id}-groove)`;
  const glass = `url(#${id}-glass)`;
  const pool = `url(#${id}-pool)`;
  const carve = `url(#${id}-carve)`;
  const soft = `url(#${id}-soft)`;

  if (kind === "scan") {
    return (
      <g filter={carve}>
        <ellipse cx="32" cy="46" rx="17" ry="9" fill={pool} filter={soft} />
        <circle cx="32" cy="32" r="12.2" stroke={groove} strokeWidth="6.5" fill="none" />
        {[14, 50].map((y, i) => (
          <rect key={`v${i}`} x="30.2" y={y - 4} width="3.6" height="8" rx="1.4" fill={groove} />
        ))}
        {[14, 50].map((x, i) => (
          <rect key={`h${i}`} x={x - 4} y="30.2" width="8" height="3.6" rx="1.4" fill={groove} />
        ))}
        <circle cx="32" cy="32" r="5.2" fill={groove} />
        <circle cx="32" cy="32" r="10.2" fill={glass} />
        <g opacity="0.22" stroke={ray} strokeWidth="0.55">
          {Array.from({ length: 14 }).map((_, i) => {
            const a = (i / 14) * Math.PI * 2 - Math.PI / 2;
            return (
              <line
                key={i}
                x1={32}
                y1={32}
                x2={32 + Math.cos(a) * 9.5}
                y2={32 + Math.sin(a) * 9.5}
              />
            );
          })}
        </g>
        <circle cx="32" cy="32" r="12.2" stroke={steel} strokeWidth="3.4" fill="none" />
        <circle cx="32" cy="32" r="12.2" stroke={hi} strokeWidth="1.15" fill="none" />
        <circle cx="32" cy="32" r="10.2" stroke="#000" strokeWidth="1.1" opacity="0.55" fill="none" />
        <rect x="30.6" y="11.5" width="2.8" height="6.2" rx="1.1" fill={steel} />
        <rect x="30.6" y="46.3" width="2.8" height="6.2" rx="1.1" fill={steel} />
        <rect x="11.5" y="30.6" width="6.2" height="2.8" rx="1.1" fill={steel} />
        <rect x="46.3" y="30.6" width="6.2" height="2.8" rx="1.1" fill={steel} />
        <circle cx="32" cy="32" r="3.6" fill={steel} />
        <circle cx="32" cy="32" r="3.6" stroke={hi} strokeWidth="0.9" fill="none" />
        <circle cx="31.1" cy="30.9" r="1" fill="#e4e4e7" opacity="0.4" />
      </g>
    );
  }

  /* Enrichment → carved magnifying glass */
  if (kind === "enrich") {
    return (
      <g filter={carve}>
        <ellipse cx="34" cy="48" rx="16" ry="8" fill={pool} filter={soft} />

        {/* Deep trench */}
        <circle cx="28" cy="28" r="13" stroke={groove} strokeWidth="7" fill="none" />
        <path d="M38 38l12.5 12.5" stroke={groove} strokeWidth="8" strokeLinecap="round" />

        {/* Glass lens chamber */}
        <circle cx="28" cy="28" r="10.5" fill={glass} />
        <g opacity="0.2" stroke={ray} strokeWidth="0.55">
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={28}
                y1={28}
                x2={28 + Math.cos(a) * 9.5}
                y2={28 + Math.sin(a) * 9.5}
              />
            );
          })}
        </g>

        {/* Metal rim of the lens */}
        <circle cx="28" cy="28" r="13" stroke={steel} strokeWidth="3.5" fill="none" />
        <circle cx="28" cy="28" r="13" stroke={hi} strokeWidth="1.15" fill="none" />
        <circle cx="28" cy="28" r="10.5" stroke="#000" strokeWidth="1.1" opacity="0.5" fill="none" />

        {/* Metal handle */}
        <path d="M38 38l12.5 12.5" stroke={steel} strokeWidth="4.2" strokeLinecap="round" />
        <path d="M38.5 38.5l11.5 11.5" stroke={hi} strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="49.5" cy="49.5" r="2.4" fill={steel} />
        <circle cx="48.8" cy="48.7" r="0.7" fill="#e4e4e7" opacity="0.35" />
      </g>
    );
  }

  if (kind === "inbox") {
    const path =
      "M15 23.5L32 15l17 8.5V41.5a4.5 4.5 0 01-4.5 4.5h-25A4.5 4.5 0 0115 41.5V23.5z";
    return (
      <g filter={carve}>
        <ellipse cx="32" cy="48" rx="17" ry="8" fill={pool} filter={soft} />
        <path d={path} stroke={groove} strokeWidth="7" fill="none" />
        <path d={path} fill={glass} />
        <path d={path} stroke={steel} strokeWidth="3.2" fill="none" />
        <path d={path} stroke={hi} strokeWidth="1.05" fill="none" />
        <path d="M15 23.5L32 35l17-11.5" stroke={groove} strokeWidth="5.5" fill="none" />
        <path d="M15 23.5L32 35l17-11.5" stroke={steel} strokeWidth="2.8" fill="none" />
        <path d="M15 23.5L32 35l17-11.5" stroke={hi} strokeWidth="0.95" fill="none" />
      </g>
    );
  }

  if (kind === "voice" || kind === "ai") {
    return (
      <g filter={carve}>
        <ellipse cx="32" cy="50" rx="15" ry="7" fill={pool} filter={soft} />
        <rect x="25.5" y="13" width="13" height="26" rx="6.5" stroke={groove} strokeWidth="6" fill="none" />
        <rect x="26.5" y="14.5" width="11" height="23" rx="5.5" fill={glass} />
        <rect x="25.5" y="13" width="13" height="26" rx="6.5" stroke={steel} strokeWidth="2.9" fill="none" />
        <rect x="25.5" y="13" width="13" height="26" rx="6.5" stroke={hi} strokeWidth="1" fill="none" />
        <path d="M19.5 30c0 7.2 5.6 13.5 12.5 13.5S44.5 37.2 44.5 30" stroke={groove} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M19.5 30c0 7.2 5.6 13.5 12.5 13.5S44.5 37.2 44.5 30" stroke={steel} strokeWidth="2.7" fill="none" strokeLinecap="round" />
        <path d="M32 43.5v7" stroke={groove} strokeWidth="5" strokeLinecap="round" />
        <path d="M32 43.5v7" stroke={steel} strokeWidth="2.7" strokeLinecap="round" />
      </g>
    );
  }

  /* Pipeline / oppfølging → rising bars */
  return (
    <g filter={carve}>
      <ellipse cx="32" cy="50" rx="16" ry="7" fill={pool} filter={soft} />
      {[
        { x: 10, y: 15, w: 12, h: 33, o: 0.5 },
        { x: 26, y: 21, w: 12, h: 27, o: 0.72 },
        { x: 42, y: 27, w: 12, h: 21, o: 1 },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="3" stroke={groove} strokeWidth="5" fill="none" />
          <rect x={b.x + 1} y={b.y + 1} width={b.w - 2} height={b.h - 2} rx="2.4" fill={glass} opacity={b.o} />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="3" stroke={steel} strokeWidth="2.5" fill="none" />
        </g>
      ))}
    </g>
  );
}
