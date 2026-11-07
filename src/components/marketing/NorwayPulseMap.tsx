"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type City = {
  id: string;
  name: string;
  x: number;
  y: number;
  delay: string;
};

/** City coords in original Simplemaps space (0–1000). Map viewBox adds padding. */
const MAP_VB = { x: -140, y: -120, w: 1280, h: 1240 } as const;

const CITIES: City[] = [
  { id: "oslo", name: "Oslo", x: 280, y: 833, delay: "0s" },
  { id: "bergen", name: "Bergen", x: 118, y: 798, delay: "0.45s" },
  { id: "trondheim", name: "Trondheim", x: 298, y: 548, delay: "0.9s" },
  { id: "stavanger", name: "Stavanger", x: 128, y: 928, delay: "1.35s" },
  { id: "tromso", name: "Tromsø", x: 575, y: 148, delay: "1.8s" },
  { id: "bodo", name: "Bodø", x: 378, y: 392, delay: "2.2s" },
  { id: "kristiansand", name: "Kristiansand", x: 178, y: 938, delay: "2.6s" },
  { id: "alesund", name: "Ålesund", x: 168, y: 688, delay: "3s" },
  { id: "lillehammer", name: "Lillehammer", x: 292, y: 728, delay: "3.4s" },
  { id: "fredrikstad", name: "Fredrikstad", x: 318, y: 878, delay: "3.8s" },
];

const PINGS = [
  { city: "Oslo", text: "+5 nye firma", detail: "3 med e-post" },
  { city: "Bergen", text: "+2 uten nettside", detail: "Vestland" },
  { city: "Tromsø", text: "+1 med telefon", detail: "Nord" },
  { city: "Trondheim", text: "+3 nye firma", detail: "Trøndelag" },
  { city: "Stavanger", text: "+2 med e-post", detail: "Rogaland" },
  { city: "Bodø", text: "+1 nytt firma", detail: "Nordland" },
] as const;

function pct(axis: "x" | "y", value: number) {
  if (axis === "x") return ((value - MAP_VB.x) / MAP_VB.w) * 100;
  return ((value - MAP_VB.y) / MAP_VB.h) * 100;
}

type Props = {
  className?: string;
};

export function NorwayPulseMap({ className }: Props) {
  const [pingIndex, setPingIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setPingIndex((i) => (i + 1) % PINGS.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const ping = PINGS[pingIndex]!;
  const active = CITIES.find((c) => c.name === ping.city) ?? CITIES[0]!;

  return (
    <div className={cn("auth-norway", className)} aria-hidden>
      <div className="auth-norway-mist" />
      <div className="auth-norway-mist auth-norway-mist--soft" />

      <div className="auth-norway-stage">
        {/* Shape-matched glow (blurred Norway), not a round blob */}
        <img
          className="auth-norway-glow auth-norway-glow--far"
          src="/images/norway-outline.svg?v=5"
          alt=""
          draggable={false}
        />
        <img
          className="auth-norway-glow auth-norway-glow--mid"
          src="/images/norway-outline.svg?v=5"
          alt=""
          draggable={false}
        />
        <img
          className="auth-norway-glow auth-norway-glow--near"
          src="/images/norway-outline.svg?v=5"
          alt=""
          draggable={false}
        />

        <img
          className="auth-norway-map"
          src="/images/norway-outline.svg?v=5"
          alt=""
          draggable={false}
        />

        <svg
          className="auth-norway-dots"
          viewBox={`${MAP_VB.x} ${MAP_VB.y} ${MAP_VB.w} ${MAP_VB.h}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {CITIES.map((city) => (
            <g key={city.id}>
              <circle
                className="auth-norway-ring"
                cx={city.x}
                cy={city.y}
                r="22"
                style={{ animationDelay: city.delay }}
              />
              <circle
                className="auth-norway-ring auth-norway-ring--late"
                cx={city.x}
                cy={city.y}
                r="22"
                style={{ animationDelay: `calc(${city.delay} + 1.2s)` }}
              />
              <circle
                className="auth-norway-core"
                cx={city.x}
                cy={city.y}
                r="4.5"
                style={{ animationDelay: city.delay }}
              />
            </g>
          ))}
          <circle
            key={`spot-${ping.city}-${pingIndex}`}
            className="auth-norway-spot"
            cx={active.x}
            cy={active.y}
            r="34"
          />
        </svg>

        <div
          key={`${ping.city}-${pingIndex}`}
          className={cn(
            "auth-norway-toast",
            active.y < 260 && "auth-norway-toast--below",
            active.x > 620 && "auth-norway-toast--left",
          )}
          style={{
            left: `${pct("x", active.x)}%`,
            top: `${pct("y", active.y)}%`,
          }}
        >
          <span className="auth-norway-toast-city">{ping.city}</span>
          <span className="auth-norway-toast-main">{ping.text}</span>
          <span className="auth-norway-toast-detail">{ping.detail}</span>
        </div>
      </div>

      <p className="auth-norway-caption">
        Nye firma dukker opp over hele Norge
      </p>
    </div>
  );
}
