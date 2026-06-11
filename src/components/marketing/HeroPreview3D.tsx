import type { ReactNode } from "react";
import { HeroScanMockup } from "@/components/marketing/HeroScanMockup";
import { LandingAnimationPause } from "@/components/marketing/LandingAnimationPause";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

function Hero3DCard({ children }: { children: ReactNode }) {
  return (
    <div className="hero-preview-3d-card">
      <div className="hero-preview-3d-glow" aria-hidden />
      <div className="hero-preview-3d-floor" aria-hidden />
      <div className="agent-promo-3d-frame hero-preview-3d-frame">{children}</div>
    </div>
  );
}

export function HeroPreview3D({ className }: Props) {
  return (
    <LandingAnimationPause className={cn("hero-preview-3d-wrap", className)}>
      <div className="hero-preview-3d-scene" aria-hidden={false}>
        <div className="hero-preview-3d-orb" aria-hidden />

        <Hero3DCard>
          <HeroScanMockup />
        </Hero3DCard>
      </div>
    </LandingAnimationPause>
  );
}
