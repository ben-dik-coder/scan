"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const OverviewFlowCanvas = dynamic(
  () =>
    import("./OverviewFlowCanvas").then((m) => m.OverviewFlowCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="overview-engine">
        <div className="overview-engine-frame overview-engine-frame--webgl">
          <div className="overview-engine-canvas-wrap overview-engine-loading">
            <div className="overview-engine-loading-orb" />
            <p>Laster 3D-flyt…</p>
          </div>
        </div>
      </div>
    ),
  }
);

type Props = {
  queueCount: number;
  className?: string;
};

/** Dynamisk WebGL-flyt: Kø → Smartliste → Ring */
export function OverviewFlowStory({ queueCount, className }: Props) {
  return (
    <div className={cn(className)}>
      <OverviewFlowCanvas queueCount={queueCount} />
    </div>
  );
}
