"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "nylead-cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Informasjonskapsler"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-white/10 bg-brand-navy px-4 py-3 sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="font-sans text-sm leading-relaxed text-white/80">
          Vi bruker bare nødvendige informasjonskapsler så du kan logge inn. Ingen
          reklame-cookies.{" "}
          <Link
            href="/personvern"
            className="text-brand-goldLight underline underline-offset-2 hover:text-brand-gold"
          >
            Les mer
          </Link>
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 rounded-md bg-brand-gold px-5 py-2 font-display text-xs font-bold uppercase tracking-[0.12em] text-brand-navy transition hover:bg-brand-goldLight"
        >
          Godta
        </button>
      </div>
    </div>
  );
}
