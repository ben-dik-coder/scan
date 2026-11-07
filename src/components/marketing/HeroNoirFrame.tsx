import { HeroScanMockup } from "@/components/marketing/HeroScanMockup";
import { LandingAnimationPause } from "@/components/marketing/LandingAnimationPause";
import { cn } from "@/lib/utils";

/** Resend-style product stage: real UI, CSS sheen — no bought 3D. */
export function HeroNoirFrame({ className }: { className?: string }) {
  return (
    <LandingAnimationPause className={cn("hero-noir-stage", className)}>
      <div className="hero-noir-frame">
        <div className="hero-noir-sheen" aria-hidden />
        <div className="hero-noir-chrome">
          <span className="hero-noir-dot" />
          <span className="hero-noir-dot" />
          <span className="hero-noir-dot" />
          <span className="hero-noir-chrome-label">Skann</span>
        </div>
        <div className="hero-noir-viewport">
          <HeroScanMockup />
        </div>
      </div>
    </LandingAnimationPause>
  );
}
