"use client";

import { useEffect } from "react";

/** Fjern Skann-glass-tema når brukeren er på forsiden (etter navigasjon fra /app). */
export function LandingThemeReset() {
  useEffect(() => {
    document.documentElement.classList.remove("app-glass-theme");
    document.body.classList.remove("app-glass-theme");
    document.documentElement.style.backgroundColor = "";
    document.body.style.color = "";
  }, []);

  return null;
}
