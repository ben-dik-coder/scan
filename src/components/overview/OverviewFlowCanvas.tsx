"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { OverviewFlowScene } from "./OverviewFlowScene";
import { cn } from "@/lib/utils";

const STAGE_LABELS = ["Kø", "Smartliste", "Ring"] as const;

type Props = {
  queueCount: number;
  className?: string;
};

export function OverviewFlowCanvas({ queueCount, className }: Props) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className={cn("overview-engine", className)}>
      <div className="overview-engine-frame overview-engine-frame--webgl">
        <div className="overview-engine-canvas-wrap">
          {reduceMotion ? (
            <div className="overview-engine-fallback">
              <p className="text-3xl font-bold text-white">{queueCount}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-emerald-300">
                leads i kø
              </p>
            </div>
          ) : (
            <Canvas
              shadows
              dpr={[1, 1.75]}
              camera={{ position: [-2.5, 1.85, 4.2], fov: 36, near: 0.1, far: 40 }}
              gl={{
                antialias: true,
                alpha: false,
                powerPreference: "high-performance",
                toneMapping: THREE.ACESFilmicToneMapping,
              }}
            >
              <Suspense fallback={null}>
                <OverviewFlowScene queueCount={queueCount} onStage={setStage} />
              </Suspense>
            </Canvas>
          )}
        </div>

        <div className="overview-engine-rail">
          {STAGE_LABELS.map((label, i) => (
            <span key={label} className="contents">
              {i > 0 ? <span className="eng-rail-sep" /> : null}
              <span
                className={cn(
                  "eng-rail-step",
                  stage === i && "eng-rail-step--live"
                )}
              >
                <b>0{i + 1}</b>
                {label}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
