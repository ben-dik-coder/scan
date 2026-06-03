type LandingFoldTransitionProps = {
  /** dark-to-light: navy workflow → white sheet. light-to-light: brand-surface → white. */
  variant?: "dark-to-light" | "light-to-light";
};

type FoldSvgProps = {
  topFill: string;
  gradientId: string;
  /** Polygon lower-left vertex (viewBox 100×24). */
  foldX: number;
  /** Feather gradient along normal to diagonal (100,0)→(foldX,24). */
  gradient: { x1: number; y1: number; x2: number; y2: number };
  className?: string;
};

function FoldSvg({
  topFill,
  gradientId,
  foldX,
  gradient,
  className,
}: FoldSvgProps) {
  const foldY = 24.08;
  return (
    <svg
      className={className ?? "landing-fold-svg block h-full w-full"}
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      shapeRendering="geometricPrecision"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={gradient.x1}
          y1={gradient.y1}
          x2={gradient.x2}
          y2={gradient.y2}
        >
          <stop offset="0%" stopColor={topFill} />
          <stop offset="55%" stopColor={topFill} />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <path fill="#ffffff" d="M0,0 H100 V24 H0 Z" />
      <path
        fill={`url(#${gradientId})`}
        d={`M0,0 H100 L${foldX},${foldY} Z`}
      />
      <rect x="0" y="23.5" width="100" height="1" fill="#ffffff" />
    </svg>
  );
}

/**
 * Dekorativ «papirbrett»-overgang mellom landing-seksjoner.
 * Asymmetrisk diagonal — mørk navy eller lys surface over, hvit under.
 */
export function LandingFoldTransition({
  variant = "light-to-light",
}: LandingFoldTransitionProps) {
  const topFill =
    variant === "dark-to-light"
      ? "var(--brand-navy, #0a2540)"
      : "var(--brand-surface, #f6f9fc)";

  return (
    <div
      className="landing-fold relative h-12 w-full -mt-px sm:h-16 md:h-20 lg:h-24"
      aria-hidden="true"
    >
      {/* Mobil: mykere diagonal — venstre hjørne mindre ekstremt */}
      <FoldSvg
        className="landing-fold-svg block h-full w-full md:hidden"
        topFill={topFill}
        gradientId={`landing-fold-feather-${variant}-mobile`}
        foldX={38}
        gradient={{ x1: 68.8, y1: 11.5, x2: 69.2, y2: 12.5 }}
      />
      {/* Desktop (md+): uendret koordinater og gradient */}
      <FoldSvg
        className="landing-fold-svg hidden h-full w-full md:block"
        topFill={topFill}
        gradientId={`landing-fold-feather-${variant}-desktop`}
        foldX={21.85}
        gradient={{ x1: 60.9, y1: 11.6, x2: 61.2, y2: 12.2 }}
      />
    </div>
  );
}
