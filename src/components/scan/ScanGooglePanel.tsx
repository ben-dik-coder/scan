"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Search, X } from "lucide-react";
import { buildGoogleSearchUrl } from "@/lib/scan/google-search-query";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "nylead-scan-google-open";

type Props = {
  /** Forhåndsutfylt søk, f.eks. firmanavn + kommune */
  searchQuery: string;
  /** Øk tall for å åpne panelet (f.eks. ved klikk på firmanavn) */
  requestOpen?: number;
};

export function ScanGooglePanel({ searchQuery, requestOpen = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(searchQuery);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!requestOpen || !searchQuery.trim()) return;
    setOpen(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, [requestOpen, searchQuery]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const trimmed = query.trim();
  const googleUrl = useMemo(() => buildGoogleSearchUrl(trimmed, true), [trimmed]);
  const externalUrl = buildGoogleSearchUrl(trimmed, false);

  return (
    <div className="scan-google-panel">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-controls="scan-google-panel-body"
          className="scan-btn-ghost inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs font-semibold"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          {open ? "Lukk Google" : "Åpne Google"}
        </button>
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="scan-glass-muted inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-sky-200"
        >
          <ExternalLink className="h-3 w-3" aria-hidden />
          Åpne i ny fane
        </a>
      </div>

      {open && (
        <div
          id="scan-google-panel-body"
          className="scan-google-panel-body scan-surface mt-2 overflow-hidden rounded-xl border border-white/15"
          role="region"
          aria-label="Google-søk"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-2 py-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="scan-input min-h-0 flex-1 py-2 text-base sm:text-sm"
              placeholder="Søk firma på Google…"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="scan-glass-mobile-sheet-close shrink-0 rounded-lg p-2"
              aria-label="Lukk Google-panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="scan-glass-muted border-b border-white/10 px-3 py-1.5 text-[10px] leading-snug">
            Google tillater ikke alltid visning inne i appen. Bruk «Åpne i ny fane» hvis vinduet
            er tomt.
          </p>
          <iframe
            key={googleUrl}
            title="Google-søk"
            src={googleUrl}
            className={cn(
              "scan-google-panel-iframe block w-full",
              "h-[min(50dvh,420px)] sm:h-[min(45vh,480px)]"
            )}
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      )}
    </div>
  );
}
