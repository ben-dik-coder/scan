"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  /** Extra viewport margin before pausing (default: 80px vertical). */
  rootMargin?: string;
  /** Pause SVG SMIL animations (e.g. animateMotion) when off-screen. */
  pauseSvg?: boolean;
};

const ANIMATION_SELECTOR =
  ".sources-enrichment-scan-beam, .sources-enrichment-flow-paths line, .sources-enrichment-connector-line, .sources-enrichment-engine-pill, .sources-enrichment-engine-ring, .sources-enrichment-engine-check, .sources-enrichment-engine-scanned, .sources-enrichment-badge, .sources-enrichment-swap, .hero-scan-track, .hero-scan-row-highlight, .hero-scan-cursor, .hero-scan-score, .landing-marquee, .agent-promo-scenario--1, .agent-promo-scenario--2, .agent-promo-scenario--3, .agent-promo-scenario--1 .agent-promo-user-msg, .agent-promo-scenario--2 .agent-promo-user-msg, .agent-promo-scenario--3 .agent-promo-user-msg, .agent-promo-scenario--1 .agent-promo-thinking, .agent-promo-scenario--2 .agent-promo-thinking, .agent-promo-scenario--3 .agent-promo-thinking, .agent-promo-scenario--1 .agent-promo-assistant-msg, .agent-promo-scenario--2 .agent-promo-assistant-msg, .agent-promo-scenario--3 .agent-promo-assistant-msg, .agent-promo-scenario--1 .agent-promo-link, .agent-promo-scenario--2 .agent-promo-link, .agent-promo-scenario--3 .agent-promo-link, .agent-promo-scenario--1 .agent-promo-saved, .agent-promo-scenario--2 .agent-promo-saved, .agent-promo-scenario--3 .agent-promo-saved, .agent-promo-input-text--1, .agent-promo-input-text--2, .agent-promo-input-text--3, .agent-promo-input-placeholder, .agent-promo-send, .agent-promo-suggestion--1, .agent-promo-suggestion--2, .agent-promo-suggestion--3, .agent-promo-dot";

function parseVerticalRootMargin(rootMargin: string): number {
  const token = rootMargin.trim().split(/\s+/)[0] ?? "0px";
  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? value : 0;
}

function isVisible(el: Element, rootMargin: string): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  const margin = parseVerticalRootMargin(rootMargin);
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;

  return rect.bottom > -margin && rect.top < viewportHeight + margin;
}

function restartAnimations(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(ANIMATION_SELECTOR).forEach((node) => {
    const { animationName } = getComputedStyle(node);
    if (!animationName || animationName === "none") return;

    node.style.animation = "none";
    void node.offsetHeight;
    node.style.removeProperty("animation");
  });
}

export function LandingAnimationPause({
  children,
  className,
  rootMargin = "80px 0px",
  pauseSvg = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(true);
  const pausedRef = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const applyVisibility = (visible: boolean) => {
      const nextPaused = !visible;
      if (pausedRef.current && !nextPaused) {
        requestAnimationFrame(() => restartAnimations(el));
      }
      pausedRef.current = nextPaused;
      setPaused(nextPaused);
    };

    const measure = () => applyVisibility(isVisible(el, rootMargin));

    measure();
    const raf = requestAnimationFrame(measure);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        applyVisibility(entry.isIntersecting);
      },
      { rootMargin, threshold: 0 },
    );

    io.observe(el);

    const onLayoutChange = () => measure();
    window.addEventListener("scroll", onLayoutChange, { passive: true });
    window.addEventListener("resize", onLayoutChange, { passive: true });
    window.addEventListener("hashchange", onLayoutChange);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onLayoutChange);
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("hashchange", onLayoutChange);
    };
  }, [rootMargin]);

  useEffect(() => {
    if (!pauseSvg || !ref.current) return;

    ref.current.querySelectorAll("svg").forEach((svg) => {
      const animSvg = svg as SVGSVGElement & {
        pauseAnimations?: () => void;
        unpauseAnimations?: () => void;
      };
      if (paused) {
        animSvg.pauseAnimations?.();
      } else {
        animSvg.unpauseAnimations?.();
      }
    });
  }, [paused, pauseSvg]);

  return (
    <div
      ref={ref}
      className={cn("landing-anim-wrap", paused && "landing-anim-paused", className)}
    >
      {children}
    </div>
  );
}
