"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

function captureLayoutHeight(): number {
  const vv = window.visualViewport;
  const raw = Math.max(
    window.innerHeight || 0,
    document.documentElement?.clientHeight || 0,
    vv?.height || 0
  );
  const fallback =
    window.innerHeight || document.documentElement?.clientHeight || 667;
  return Math.round(raw > 80 ? raw : fallback);
}

/** Ekstra bunn-padding når mobil-tastatur er åpent (iOS/Android). */
export function useVisualViewportBottomInset(
  enabled = true,
  focusRef?: RefObject<HTMLElement | null>
): number {
  const [inset, setInset] = useState(0);
  const layoutHeightRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setInset(0);
      return;
    }

    layoutHeightRef.current = captureLayoutHeight();

    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const focusEl = focusRef?.current;
      const focusedOnInput =
        focusEl != null && document.activeElement === focusEl;

      if (focusRef && !focusedOnInput) {
        setInset(0);
        return;
      }

      const layoutH =
        layoutHeightRef.current ||
        Math.max(
          window.innerHeight || 0,
          document.documentElement?.clientHeight || 0
        );

      const bottom = Math.max(0, layoutH - vv.offsetTop - vv.height);
      setInset(Math.round(bottom));
    };

    const onLayoutChange = () => {
      layoutHeightRef.current = captureLayoutHeight();
      update();
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("orientationchange", onLayoutChange);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("orientationchange", onLayoutChange);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, [enabled, focusRef]);

  return inset;
}
