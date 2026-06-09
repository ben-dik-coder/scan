"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Search, X } from "lucide-react";
import {
  buildGoogleSearchUrl,
  buildLeadGoogleSearchQuery,
} from "@/lib/scan/google-search-query";
import type { CompanyWithLead } from "@/types/database";
import { cn, formatCompanyName } from "@/lib/utils";

type Props = {
  company: CompanyWithLead | null;
  onClose: () => void;
};

export function ScanGoogleSearchPopup({ company, onClose }: Props) {
  const open = company != null;
  const initialQuery = company ? buildLeadGoogleSearchQuery(company) : "";
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const trimmed = query.trim();
  const googleUrl = useMemo(() => buildGoogleSearchUrl(trimmed, true), [trimmed]);
  const externalUrl = buildGoogleSearchUrl(trimmed, false);

  if (!open || !company) return null;

  const popup = (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 z-0 bg-slate-950/65 backdrop-blur-sm"
        aria-label="Lukk Google-søk"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Google-søk for ${formatCompanyName(company.name)}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "scan-google-panel-body relative z-[1] w-full max-w-lg overflow-hidden rounded-2xl border border-white/25 bg-slate-900/95 text-white shadow-2xl backdrop-blur-xl",
          "max-h-[min(88dvh,560px)]"
        )}
      >
        <div className="flex items-start gap-2 border-b border-white/10 px-3 py-2.5">
          <Search className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden />
          <div className="min-w-0 flex-1">
            <p
              className="scan-glass-strong truncate text-sm font-semibold"
              title={formatCompanyName(company.name)}
            >
              {formatCompanyName(company.name)}
            </p>
            <p className="scan-glass-muted text-[11px]">Søk lead på Google</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Lukk"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 border-b border-white/10 px-2 py-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="scan-input min-h-0 flex-1 py-2 text-base sm:text-sm"
            placeholder="Søk firma på Google…"
            autoComplete="off"
          />
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="scan-glass-muted inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-sky-300 hover:text-sky-200"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Ny fane
          </a>
        </div>
        <p className="scan-glass-muted border-b border-white/10 px-3 py-1.5 text-[10px] leading-snug">
          Google tillater ikke alltid visning inne i appen. Bruk «Ny fane» hvis vinduet er tomt.
        </p>
        <iframe
          key={googleUrl}
          title={`Google-søk: ${formatCompanyName(company.name)}`}
          src={googleUrl}
          className={cn(
            "scan-google-panel-iframe block w-full",
            "h-[min(50dvh,380px)] sm:h-[min(45vh,420px)]"
          )}
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(popup, document.body);
}
