import { cn } from "@/lib/utils";

type IconKind = "scan" | "enrich" | "voice" | "pipeline" | "inbox" | "ai";

type Props = {
  kind: IconKind;
  className?: string;
  glow?: "mint" | "amber" | "sky" | "violet";
};

/** Merkevare-glassflis — egen SVG, ikke Lucide. */
export function BrandGlassIcon({ kind, className, glow = "mint" }: Props) {
  const gid = `nyG-${kind}-${glow}`;
  const gidWarm = `${gid}-warm`;
  return (
    <div className={cn("brand-glass", `brand-glass--${glow}`, className)}>
      <div className="brand-glass-face" aria-hidden>
        <svg
          viewBox="0 0 64 64"
          className="brand-glass-svg"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={gid} x1="12" y1="10" x2="54" y2="56" gradientUnits="userSpaceOnUse">
              <stop stopColor="#86efac" />
              <stop offset="0.55" stopColor="#34d399" />
              <stop offset="1" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id={gidWarm} x1="10" y1="8" x2="56" y2="58" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fde68a" />
              <stop offset="0.45" stopColor="#fb923c" />
              <stop offset="1" stopColor="#f97316" />
            </linearGradient>
          </defs>
          {kind === "scan" ? <ScanMark g={gid} /> : null}
          {kind === "enrich" ? <EnrichMark g={gid} /> : null}
          {kind === "voice" ? <VoiceMark g={gid} /> : null}
          {kind === "pipeline" ? <PipelineMark g={gid} /> : null}
          {kind === "inbox" ? <InboxMark g={gid} /> : null}
          {kind === "ai" ? <AiMark g={gid} warm={gidWarm} /> : null}
        </svg>
      </div>
    </div>
  );
}

function ScanMark({ g }: { g: string }) {
  return (
    <>
      <circle cx="32" cy="32" r="10" stroke={`url(#${g})`} strokeWidth="1.6" />
      <circle cx="32" cy="32" r="3.2" fill={`url(#${g})`} />
      <path
        d="M32 8v6M32 50v6M8 32h6M50 32h6"
        stroke={`url(#${g})`}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M14.5 14.5l4.2 4.2M45.3 45.3l4.2 4.2M45.3 14.5l-4.2 4.2M18.7 45.3l-4.2 4.2"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M20 32c0-6.6 5.4-12 12-12"
        stroke={`url(#${g})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        className="brand-glass-spin-arc"
      />
    </>
  );
}

function EnrichMark({ g }: { g: string }) {
  return (
    <>
      <circle cx="18" cy="22" r="4" stroke="#fff" strokeWidth="1.4" opacity="0.7" />
      <circle cx="46" cy="20" r="4" stroke="#fff" strokeWidth="1.4" opacity="0.7" />
      <circle cx="32" cy="44" r="5" fill={`url(#${g})`} opacity="0.95" />
      <path
        d="M21.5 25.5L28.5 40M42.5 24L35.5 39"
        stroke={`url(#${g})`}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M22 22h20"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.35"
      />
    </>
  );
}

function VoiceMark({ g }: { g: string }) {
  return (
    <>
      <rect
        x="27"
        y="14"
        width="10"
        height="22"
        rx="5"
        stroke={`url(#${g})`}
        strokeWidth="1.7"
      />
      <path
        d="M20 30c0 6.6 5.4 12 12 12s12-5.4 12-12"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path d="M32 42v6" stroke={`url(#${g})`} strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M14 28c2.5 8 8 13 18 13s15.5-5 18-13"
        stroke={`url(#${g})`}
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M22 24v8M42 24v8"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.35"
        className="brand-glass-pulse-bars"
      />
    </>
  );
}

/** AI mark: phone core + signal rings + soft waveform (enterprise, not sparkle). */
function AiMark({ g, warm }: { g: string; warm: string }) {
  return (
    <>
      {/* Outer signal rings */}
      <circle cx="32" cy="28" r="18" stroke={`url(#${warm})`} strokeWidth="1.2" opacity="0.28" />
      <circle cx="32" cy="28" r="13" stroke={`url(#${g})`} strokeWidth="1.35" opacity="0.55" />
      <path
        d="M19 28c0-7.2 5.8-13 13-13"
        stroke={`url(#${warm})`}
        strokeWidth="1.7"
        strokeLinecap="round"
        className="brand-glass-spin-arc"
      />
      {/* Handset body */}
      <rect
        x="26"
        y="16"
        width="12"
        height="22"
        rx="3.5"
        stroke={`url(#${warm})`}
        strokeWidth="1.7"
        fill="none"
      />
      <rect x="28.5" y="19" width="7" height="3.2" rx="1.2" fill={`url(#${warm})`} opacity="0.9" />
      <circle cx="32" cy="30" r="2.4" fill="#fff" opacity="0.85" />
      <path d="M29 35.5h6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity="0.4" />
      {/* Waveform under handset = live call */}
      <path
        d="M14 48h3l2-6 2.5 11 2.5-14 2.5 9 2-5h3"
        stroke={`url(#${warm})`}
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M40 48h2.5l1.5-4 2 8 2-10 1.5 6 1.2-3H52"
        stroke={`url(#${g})`}
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.85"
      />
    </>
  );
}

function PipelineMark({ g }: { g: string }) {
  return (
    <>
      <rect x="12" y="16" width="12" height="32" rx="3" stroke="#fff" strokeWidth="1.3" opacity="0.4" />
      <rect x="26" y="22" width="12" height="26" rx="3" stroke="#fff" strokeWidth="1.3" opacity="0.65" />
      <rect x="40" y="28" width="12" height="20" rx="3" fill={`url(#${g})`} opacity="0.95" />
      <circle cx="46" cy="34" r="2" fill="#04140f" />
    </>
  );
}

function InboxMark({ g }: { g: string }) {
  return (
    <>
      <path
        d="M14 24l18-8 18 8v18a4 4 0 01-4 4H18a4 4 0 01-4-4V24z"
        stroke="#fff"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <path
        d="M14 24l18 11 18-11"
        stroke={`url(#${g})`}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M24 40h16"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.35"
      />
    </>
  );
}
