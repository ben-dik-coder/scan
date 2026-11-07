"use client";

import dynamic from "next/dynamic";
import { LandingAnimationPause } from "@/components/marketing/LandingAnimationPause";
import { cn } from "@/lib/utils";

const HeroNetworkMark = dynamic(
  () =>
    import("@/components/marketing/HeroNetworkMark").then((m) => m.HeroNetworkMark),
  {
    ssr: false,
    loading: () => <div className="hero-orbit-canvas hero-orbit-canvas--loading" aria-hidden />,
  },
);

/** Enterprise hero visual — real Three.js network mark. */
export function HeroOrbitStage({ className }: { className?: string }) {
  return (
    <LandingAnimationPause className={cn("hero-orbit", className)}>
      <div className="hero-orbit-stage">
        <HeroNetworkMark className="hero-orbit-canvas" />
      </div>
    </LandingAnimationPause>
  );
}
