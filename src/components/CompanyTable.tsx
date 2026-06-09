"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LEAD_STATUSES, statusLabel } from "@/lib/sales/constants";
import { explainQueueScore } from "@/lib/sales/queue-score";
import type { CompanyWithLead } from "@/types/database";
import type { WebsiteScanResult } from "@/lib/website-scan/types";
import {
  resolveCompanyEmail,
  type ResolvedCompanyEmail,
} from "@/lib/website-scan/resolve-company-email";
import { resolveCompanyPhone } from "@/lib/website-scan/resolve-company-contact";
import { hasUncertainWebsiteHits, displayNameDiffersFromLegal } from "@/lib/website-scan/parse-results";
import { StatusPill, EmptyState } from "@/components/ui/primitives";
import { ScanGoogleSearchPopup } from "@/components/scan/ScanGoogleSearchPopup";
import { cn, formatRegisteredDate } from "@/lib/utils";
import { Globe, Globe2, HelpCircle, ListPlus, Mail, Radar, X } from "lucide-react";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

type ColumnId =
  | "score"
  | "email"
  | "phone"
  | "website"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "ceo"
  | "status";

const COLUMN_LABELS: Record<ColumnId, string> = {
  score: "Score",
  email: "E-post",
  phone: "Tlf",
  website: "Nettside",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  ceo: "Daglig leder",
  status: "Status",
};

const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = [
  "email",
  "website",
  "status",
];

const OPTIONAL_COLUMNS: ColumnId[] = [
  "phone",
  "facebook",
  "instagram",
  "linkedin",
  "ceo",
];

const COLUMN_STORAGE_KEY = "nylead-scan-visible-columns-v2";

type Props = {
  companies: CompanyWithLead[];
  selected: Set<string>;
  onToggle: (orgnr: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  onStatusChange?: (orgnr: string, status: string) => void;
  liveBrreg?: boolean;
  websiteScans?: Map<string, WebsiteScanResult>;
  scanningOrgnrs?: Set<string>;
  viewMode?: "table" | "cards";
  /** Sortert liste — vis score-kolonne når satt */
  queueScores?: Map<string, number>;
  /** Valgfri callback når bruker åpner Google-søk fra e-post-kolonnen */
  onGoogleSearch?: (company: CompanyWithLead) => void;
  /** Hurtighandlinger som vises ved hover på en rad */
  onQuickQueue?: (company: CompanyWithLead) => void;
  onQuickEmail?: (company: CompanyWithLead) => void;
  onQuickCheckWebsite?: (company: CompanyWithLead) => void;
};

function loadVisibleColumns(): Set<ColumnId> {
  if (typeof window === "undefined") return new Set(DEFAULT_VISIBLE_COLUMNS);
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_VISIBLE_COLUMNS);
    const parsed = JSON.parse(raw) as ColumnId[];
    return new Set(parsed.filter((id) => id in COLUMN_LABELS));
  } catch {
    return new Set(DEFAULT_VISIBLE_COLUMNS);
  }
}

function PresenceBadge({
  kind,
  label,
}: {
  kind: "ok" | "warn" | "muted" | "info";
  label: string;
}) {
  const styles = {
    ok: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-900",
    muted: "bg-slate-100 text-slate-600",
    info: "bg-sky-100 text-sky-800",
  };
  return (
    <span
      className={cn(
        "ml-1 inline-flex shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide",
        styles[kind]
      )}
    >
      {label}
    </span>
  );
}

function GulesiderBadge({
  scan,
  scanning,
}: {
  scan?: WebsiteScanResult;
  scanning?: boolean;
}) {
  if (scanning || !scan?.gulesiderListed || !scan.gulesiderUrl) return null;
  return (
    <a
      href={scan.gulesiderUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Finnes på Gulesider"
      className="inline-flex"
    >
      <PresenceBadge kind="info" label="Gul" />
    </a>
  );
}

function WebsiteCell({
  scan,
  scanning,
  companyName,
}: {
  scan?: WebsiteScanResult;
  scanning?: boolean;
  companyName: string;
}) {
  if (scanning) {
    return <span className="cv-muted">Sjekker…</span>;
  }
  if (!scan) {
    return (
      <span className="cv-muted inline-flex items-center gap-0.5" title="Ikke sjekket">
        <HelpCircle className="h-3 w-3 shrink-0" />
        —
      </span>
    );
  }
  if (scan.hasWebsite) {
    const showDisplayName =
      scan.displayName &&
      displayNameDiffersFromLegal(scan.displayName, companyName);

    return (
      <div className="min-w-0">
        <a
          href={scan.websiteUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="cv-accent inline-flex max-w-[10rem] items-center gap-0.5 truncate"
          title={scan.websiteUrl ?? scan.websiteDomain ?? "Har nettside"}
        >
          <Globe2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{scan.websiteDomain ?? "Ja"}</span>
        </a>
        {showDisplayName && (
          <p
            className="cv-meta max-w-[10rem] truncate text-sky-700"
            title={`Vises som: ${scan.displayName}`}
          >
            vises som: {scan.displayName}
          </p>
        )}
      </div>
    );
  }
  if (scan.websiteKind === "booking_only" && scan.confidence !== "low") {
    return (
      <span className="inline-flex max-w-[10rem] items-center gap-0.5 truncate font-semibold text-amber-700">
        <Globe className="h-3 w-3 shrink-0" />
        Kun booking
      </span>
    );
  }
  if (hasUncertainWebsiteHits(scan.topHits, companyName)) {
    return (
      <span className="inline-flex max-w-[10rem] items-center gap-0.5 truncate font-semibold text-sky-700">
        <HelpCircle className="h-3 w-3 shrink-0" />
        Usikker
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 font-semibold text-amber-800">
      <Globe className="h-3 w-3 shrink-0" />
      Ingen nettside
    </span>
  );
}

const PLATFORM_SOURCE_LABELS: Record<string, string> = {
  booking: "booking",
  gulesider: "Gulesider",
  "1881": "1881",
  proff: "Proff",
  directory: "katalog",
  website: "nettside",
  facebook: "Facebook",
  instagram: "Instagram",
  google_places: "Google",
};

function PhoneCell({
  company,
  scan,
}: {
  company: { phone?: string | null; mobile?: string | null };
  scan?: WebsiteScanResult;
}) {
  const resolved = resolveCompanyPhone(company, scan);
  if (!resolved) return <span className="cv-muted">—</span>;
  const platformLabel =
    resolved.source === "platform" && scan?.enrichedPhoneSource
      ? PLATFORM_SOURCE_LABELS[scan.enrichedPhoneSource] ?? scan.enrichedPhoneSource
      : null;
  return (
    <a href={`tel:${resolved.phone}`} className="cv-link truncate">
      {resolved.phone}
      {platformLabel && (
        <span className="ml-1 shrink-0 rounded bg-emerald-100 px-1 text-[9px] font-semibold text-emerald-800">
          {platformLabel}
        </span>
      )}
    </a>
  );
}

function EmailCell({ resolved }: { resolved: ResolvedCompanyEmail }) {
  const { email, source, isPersonal } = resolved;
  return (
    <a
      href={`mailto:${email}`}
      className={cn("cv-link block truncate", isPersonal && "text-amber-700")}
      title={email}
    >
      {email}
      {isPersonal && <span className="ml-0.5 text-[10px] opacity-80">(pers.)</span>}
      {source === "facebook" && (
        <span className="ml-1 shrink-0 rounded bg-blue-100 px-1 text-[9px] font-semibold text-blue-700">
          Fra Facebook
        </span>
      )}
      {source === "instagram" && (
        <span className="ml-1 shrink-0 rounded bg-emerald-100 px-1 text-[9px] font-semibold text-emerald-800">
          Fra Instagram
        </span>
      )}
    </a>
  );
}

/** Klikk på navn → Google-iframe-popup (add-on, endrer ikke andre innstillinger). */
function CompanyNameButton({
  company,
  onGoogleSearch,
  className,
  id,
}: {
  company: CompanyWithLead;
  onGoogleSearch: (company: CompanyWithLead) => void;
  className?: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={(e) => {
        e.stopPropagation();
        onGoogleSearch(company);
      }}
      className={cn(
        "cv-firma max-w-full truncate text-left font-semibold hover:text-sky-200 hover:underline",
        className
      )}
      title={`Søk «${company.name}» på Google`}
    >
      {company.name}
    </button>
  );
}

function SocialCell({
  scanning,
  url,
  icon,
  label,
  viaFb,
  viaWebsite,
  confidence,
  scanned,
}: {
  scanning: boolean;
  url?: string | null;
  icon: ReactNode;
  label: string;
  viaFb?: boolean;
  viaWebsite?: boolean;
  confidence?: "high" | "medium" | "low";
  scanned?: boolean;
}) {
  if (scanning) return <span className="cv-muted">…</span>;
  if (!url) {
    if (scanned) {
      return <span className="cv-muted text-[11px]">Ingen</span>;
    }
    return <span className="cv-muted">—</span>;
  }
  const uncertain = confidence === "medium";
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex max-w-[6rem] items-center gap-0.5 truncate",
        uncertain ? "font-semibold text-sky-700" : "cv-link"
      )}
      title={uncertain ? `${label} (usikker treff)` : label}
    >
      {icon}
      <span className="truncate">{uncertain ? "Usikker" : label}</span>
      {viaFb && (
        <span className="shrink-0 rounded bg-blue-100 px-0.5 text-[9px] font-semibold text-blue-700">FB</span>
      )}
      {viaWebsite && (
        <span className="shrink-0 rounded bg-emerald-100 px-0.5 text-[9px] font-semibold text-emerald-800">
          Web
        </span>
      )}
    </a>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-0.5 border-b border-[var(--cv-border)] py-2 last:border-b-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cv-muted)]">
        {label}
      </dt>
      <dd className="min-w-0 text-[13px]">{children}</dd>
    </div>
  );
}

function CompanyDetailBody({
  company: c,
  scan,
  isScanning,
  onStatusChange,
  onGoogleSearch,
}: {
  company: CompanyWithLead;
  scan?: WebsiteScanResult;
  isScanning?: boolean;
  onStatusChange?: (orgnr: string, status: string) => void;
  onGoogleSearch: (company: CompanyWithLead) => void;
}) {
  const status = c.user_lead?.status ?? "ny";
  const resolved = resolveCompanyEmail(c, scan);

  return (
    <dl className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <DetailRow label="Firma">
        <CompanyNameButton
          company={c}
          onGoogleSearch={onGoogleSearch}
          id="company-detail-title"
        />
        {(c.municipality_name || c.registered_at) && (
          <p className="cv-meta mt-0.5 text-[12px]">
            {c.municipality_name ?? "—"}
            {c.registered_at && ` · ${formatRegisteredDate(c.registered_at)}`}
          </p>
        )}
      </DetailRow>
      <DetailRow label="Org.nr">
        <span className="cv-mono">{c.orgnr}</span>
      </DetailRow>
      <DetailRow label="E-post">
        {resolved ? (
          <EmailCell resolved={resolved} />
        ) : (
          <span className="cv-muted">—</span>
        )}
      </DetailRow>
      <DetailRow label="Tlf">
        <PhoneCell company={c} scan={scan} />
      </DetailRow>
      <DetailRow label="Nettside">
        <div className="inline-flex max-w-full flex-wrap items-center gap-0.5">
          <WebsiteCell scan={scan} scanning={isScanning} companyName={c.name} />
          {scan && !isScanning && (
            <>
              {scan.hasWebsite && <PresenceBadge kind="ok" label="Web" />}
              {!scan.hasWebsite &&
                scan.websiteKind === "none" &&
                scan.confidence !== "low" && <PresenceBadge kind="warn" label="Uten" />}
              <GulesiderBadge scan={scan} scanning={isScanning} />
            </>
          )}
        </div>
      </DetailRow>
      <DetailRow label="Gulesider">
        <div className="inline-flex max-w-full flex-wrap items-center gap-0.5">
          {isScanning ? (
            <span className="cv-muted">Sjekker…</span>
          ) : scan?.gulesiderListed && scan.gulesiderUrl ? (
            <a
              href={scan.gulesiderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cv-accent inline-flex items-center gap-0.5 truncate"
            >
              På Gulesider
            </a>
          ) : scan?.gulesiderListed === false ? (
            <span className="cv-muted">Ikke funnet</span>
          ) : (
            <span className="cv-muted">—</span>
          )}
        </div>
      </DetailRow>
      <DetailRow label="Facebook">
        <div className="inline-flex max-w-full flex-wrap items-center gap-0.5">
          <SocialCell
            scanning={!!isScanning}
            url={scan?.facebookUrl}
            confidence={scan?.facebookConfidence}
            scanned={Boolean(scan?.socialScan?.includeFacebook)}
            icon={<FacebookIcon className="h-3.5 w-3.5 shrink-0 text-blue-700" />}
            label={scan?.facebookProfile?.name ?? "FB"}
          />
          {scan?.facebookUrl && !isScanning && <PresenceBadge kind="info" label="FB" />}
          {scan?.socialScan?.includeFacebook && !scan.facebookUrl && !isScanning && (
            <PresenceBadge kind="muted" label="Nei" />
          )}
        </div>
      </DetailRow>
      <DetailRow label="Instagram">
        <div className="inline-flex max-w-full flex-wrap items-center gap-0.5">
          <SocialCell
            scanning={!!isScanning}
            url={scan?.instagramUrl}
            confidence={scan?.instagramConfidence}
            scanned={Boolean(scan?.socialScan?.includeInstagram)}
            icon={<InstagramIcon className="h-3.5 w-3.5 shrink-0 text-pink-700" />}
            label={
              scan?.instagramProfile?.username ?? scan?.instagramProfile?.name ?? "IG"
            }
            viaFb={scan?.instagramFromFacebook}
          />
          {scan?.instagramUrl && !isScanning && <PresenceBadge kind="info" label="IG" />}
          {scan?.socialScan?.includeInstagram && !scan.instagramUrl && !isScanning && (
            <PresenceBadge kind="muted" label="Nei" />
          )}
        </div>
      </DetailRow>
      <DetailRow label="LinkedIn">
        <div className="inline-flex max-w-full flex-wrap items-center gap-0.5">
          <SocialCell
            scanning={!!isScanning}
            url={scan?.linkedinUrl}
            confidence={scan?.linkedinConfidence}
            scanned={Boolean(scan?.socialScan?.includeLinkedIn)}
            icon={<LinkedinIcon className="h-3.5 w-3.5 shrink-0 text-sky-800" />}
            label="LI"
            viaFb={scan?.linkedinFromFacebook}
            viaWebsite={scan?.linkedinFromWebsite}
          />
          {scan?.linkedinUrl && !isScanning && <PresenceBadge kind="info" label="LI" />}
          {scan?.socialScan?.includeLinkedIn && !scan.linkedinUrl && !isScanning && (
            <PresenceBadge kind="muted" label="Nei" />
          )}
        </div>
      </DetailRow>
      <DetailRow label="Daglig leder">
        {c.daglig_leder ?? <span className="cv-muted">—</span>}
      </DetailRow>
      <DetailRow label="Status">
        {onStatusChange ? (
          <select
            value={status}
            onChange={(e) => onStatusChange(c.orgnr, e.target.value)}
            className="cv-status-select max-w-full"
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        ) : (
          <StatusPill status={status} label={statusLabel(status)} />
        )}
      </DetailRow>
    </dl>
  );
}

function CompanyMobileDetailSheet({
  company,
  scan,
  isScanning,
  onClose,
  onStatusChange,
  onGoogleSearch,
}: {
  company: CompanyWithLead;
  scan?: WebsiteScanResult;
  isScanning?: boolean;
  onClose: () => void;
  onStatusChange?: (orgnr: string, status: string) => void;
  onGoogleSearch: (company: CompanyWithLead) => void;
}) {
  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [handleClose]);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="scan-glass-backdrop absolute inset-0"
        aria-label="Lukk bedriftsinfo"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-detail-title"
        className="scan-glass-mobile-sheet absolute bottom-0 left-0 right-0 max-h-[min(88vh,100dvh)] overflow-y-auto border shadow-2xl"
      >
        <div className="scan-glass-mobile-sheet-header sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3">
          <p className="scan-glass-strong text-sm font-semibold">Bedriftsinfo</p>
          <button
            type="button"
            onClick={handleClose}
            className="scan-glass-mobile-sheet-close rounded-lg p-2"
            aria-label="Lukk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <CompanyDetailBody
          company={company}
          scan={scan}
          isScanning={isScanning}
          onStatusChange={onStatusChange}
          onGoogleSearch={onGoogleSearch}
        />
      </div>
    </div>
  );
}

function CompanyMobileCard({
  company: c,
  scan,
  isScanning,
  isSelected,
  onToggle,
  onOpenDetail,
  onStatusChange,
  onGoogleSearch,
}: {
  company: CompanyWithLead;
  scan?: WebsiteScanResult;
  isScanning?: boolean;
  isSelected: boolean;
  onToggle: (orgnr: string) => void;
  onOpenDetail: (orgnr: string) => void;
  onStatusChange?: (orgnr: string, status: string) => void;
  onGoogleSearch: (company: CompanyWithLead) => void;
}) {
  const status = c.user_lead?.status ?? "ny";
  const resolved = resolveCompanyEmail(c, scan);
  const resolvedPhone = resolveCompanyPhone(c, scan);

  return (
    <article
      className={cn(
        "flex gap-2 border-b border-[var(--cv-border)] px-3 py-2",
        isSelected && "bg-[var(--cv-surface)]"
      )}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle(c.orgnr)}
        aria-label={`Velg ${c.name}`}
        className="cv-checkbox mt-0.5 h-3.5 w-3.5 shrink-0 rounded accent-sky-600"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1">
          <CompanyNameButton
            company={c}
            onGoogleSearch={onGoogleSearch}
            className="min-w-0 flex-1 text-[13px]"
          />
          <button
            type="button"
            onClick={() => onOpenDetail(c.orgnr)}
            className="shrink-0 text-[10px] font-semibold text-sky-300 hover:text-sky-200"
          >
            Info
          </button>
        </div>
        {(c.municipality_name || c.registered_at) && (
          <p className="cv-meta truncate text-[11px]">
            {c.municipality_name ?? "—"}
            {c.registered_at && ` · ${formatRegisteredDate(c.registered_at)}`}
          </p>
        )}
        <p className="cv-mono mt-0.5 text-[11px]">{c.orgnr}</p>
        <div className="mt-1 min-w-0 text-[12px]">
          {resolved ? (
            <EmailCell resolved={resolved} />
          ) : resolvedPhone ? (
            <PhoneCell company={c} scan={scan} />
          ) : (
            <span className="cv-muted">Ingen kontakt</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px]">
          <WebsiteCell scan={scan} scanning={isScanning} companyName={c.name} />
          {scan && !isScanning && (
            <>
              {scan.hasWebsite && <PresenceBadge kind="ok" label="Web" />}
              {!scan.hasWebsite &&
                scan.websiteKind === "none" &&
                scan.confidence !== "low" && <PresenceBadge kind="warn" label="Uten" />}
              <GulesiderBadge scan={scan} scanning={isScanning} />
            </>
          )}
          {scan?.facebookUrl && !isScanning && (
            <a
              href={scan.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-blue-700"
              title="Facebook"
            >
              <FacebookIcon className="h-3 w-3 shrink-0" />
              <span className="text-[11px]">FB</span>
            </a>
          )}
        </div>
        <div className="mt-1.5">
          {onStatusChange ? (
            <select
              value={status}
              onChange={(e) => onStatusChange(c.orgnr, e.target.value)}
              className="cv-status-select max-w-full"
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <StatusPill status={status} label={statusLabel(status)} />
          )}
        </div>
      </div>
    </article>
  );
}

function RowQuickActions({
  company,
  onQuickQueue,
  onQuickEmail,
  onQuickCheckWebsite,
}: {
  company: CompanyWithLead;
  onQuickQueue?: (company: CompanyWithLead) => void;
  onQuickEmail?: (company: CompanyWithLead) => void;
  onQuickCheckWebsite?: (company: CompanyWithLead) => void;
}) {
  if (!onQuickQueue && !onQuickEmail && !onQuickCheckWebsite) return null;

  const actions: Array<{
    key: string;
    title: string;
    icon: ReactNode;
    onClick: (company: CompanyWithLead) => void;
  }> = [];
  if (onQuickQueue) {
    actions.push({
      key: "queue",
      title: "Legg i kø",
      icon: <ListPlus className="h-3.5 w-3.5" />,
      onClick: onQuickQueue,
    });
  }
  if (onQuickEmail) {
    actions.push({
      key: "email",
      title: "Send e-post",
      icon: <Mail className="h-3.5 w-3.5" />,
      onClick: onQuickEmail,
    });
  }
  if (onQuickCheckWebsite) {
    actions.push({
      key: "check",
      title: "Sjekk nettside",
      icon: <Radar className="h-3.5 w-3.5" />,
      onClick: onQuickCheckWebsite,
    });
  }

  return (
    <div className="cv-row-actions flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          title={action.title}
          aria-label={`${action.title}: ${company.name}`}
          onClick={(e) => {
            e.stopPropagation();
            action.onClick(company);
          }}
          className="cv-quick-btn rounded-md p-1 text-[var(--cv-muted)] transition-colors hover:bg-[var(--cv-surface)] hover:text-[var(--cv-text)]"
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}

export function CompanyTable({
  companies,
  selected,
  onToggle,
  onToggleAll,
  allSelected,
  onStatusChange,
  liveBrreg = false,
  websiteScans,
  scanningOrgnrs,
  viewMode = "table",
  queueScores,
  onGoogleSearch,
  onQuickQueue,
  onQuickEmail,
  onQuickCheckWebsite,
}: Props) {
  const [detailOrgnr, setDetailOrgnr] = useState<string | null>(null);
  const [googleSearchCompany, setGoogleSearchCompany] = useState<CompanyWithLead | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(loadVisibleColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const detailCompany =
    detailOrgnr != null ? companies.find((c) => c.orgnr === detailOrgnr) : undefined;

  const showCol = (id: ColumnId) => visibleColumns.has(id);

  // Skjul e-postkolonnen automatisk når ingen rader har e-post (unngå kolonne full av «—»)
  const anyRowHasEmail = useMemo(
    () =>
      companies.some((c) =>
        Boolean(resolveCompanyEmail(c, websiteScans?.get(c.orgnr)))
      ),
    [companies, websiteScans]
  );
  const showEmailCol = showCol("email") && anyRowHasEmail;

  function openGoogleSearch(company: CompanyWithLead) {
    setGoogleSearchCompany(company);
    onGoogleSearch?.(company);
  }

  function toggleColumn(id: ColumnId) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) return prev;
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const useCardLayout = viewMode === "cards";

  if (companies.length === 0) {
    return (
      <EmptyState
        title="Ingen firma funnet"
        description={
          liveBrreg
            ? "Prøv lengre periode, annet yrke/område, eller kjør Google-sjekk på firma med e-post."
            : "Prøv et annet område eller kjør sync fra admin."
        }
      />
    );
  }

  const cardList = (
    <>
      <div className="flex items-center gap-2 border-b border-[var(--cv-border)] bg-[var(--cv-surface)] px-3 py-1.5">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          aria-label="Velg alle"
          className="cv-checkbox h-3.5 w-3.5 rounded accent-sky-600"
        />
        <span className="text-[11px] font-semibold text-[var(--cv-muted)]">Velg alle</span>
      </div>
      <div
        className={cn(
          useCardLayout && "grid gap-2 p-2 sm:grid-cols-2 xl:grid-cols-3"
        )}
      >
        {companies.map((c) => (
          <CompanyMobileCard
            key={c.orgnr}
            company={c}
            scan={websiteScans?.get(c.orgnr)}
            isScanning={scanningOrgnrs?.has(c.orgnr)}
            isSelected={selected.has(c.orgnr)}
            onToggle={onToggle}
            onOpenDetail={setDetailOrgnr}
            onStatusChange={onStatusChange}
            onGoogleSearch={openGoogleSearch}
          />
        ))}
      </div>
    </>
  );

  return (
    <>
      {!useCardLayout && (
        <div className="nylead-theme-compact-table mb-2 flex justify-end px-2">
          <details
            className="relative text-[11px]"
            open={columnsOpen}
            onToggle={(e) => setColumnsOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="scan-btn-ghost cursor-pointer list-none px-2 py-1 [&::-webkit-details-marker]:hidden">
              Kolonner
            </summary>
            <div className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-xl border border-white/10 bg-[rgba(28,28,30,0.95)] p-2 shadow-lg backdrop-blur-xl">
              {OPTIONAL_COLUMNS.map((id) => (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] hover:bg-white/[0.06]"
                >
                  <input
                    type="checkbox"
                    checked={showCol(id)}
                    onChange={() => toggleColumn(id)}
                    className="rounded accent-sky-600"
                  />
                  {COLUMN_LABELS[id]}
                </label>
              ))}
            </div>
          </details>
        </div>
      )}

      <div
        className={cn(
          "nylead-theme-compact-table",
          useCardLayout ? "block" : "md:hidden"
        )}
      >
        {cardList}
      </div>

      {detailCompany && (
        <CompanyMobileDetailSheet
          company={detailCompany}
          scan={websiteScans?.get(detailCompany.orgnr)}
          isScanning={scanningOrgnrs?.has(detailCompany.orgnr)}
          onClose={() => setDetailOrgnr(null)}
          onStatusChange={onStatusChange}
          onGoogleSearch={openGoogleSearch}
        />
      )}

      <ScanGoogleSearchPopup
        company={googleSearchCompany}
        onClose={() => setGoogleSearchCompany(null)}
      />

      {!useCardLayout && (
        <div className="nylead-theme-compact-table hidden w-full overflow-x-auto md:block">
          <table
            className="nylead-compact-table w-full"
            style={{ minWidth: `${320 + visibleColumns.size * 88}px` }}
          >
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    aria-label="Velg alle"
                    className="cv-checkbox h-3.5 w-3.5 rounded accent-sky-600"
                  />
                </th>
                <th>Firma</th>
                {queueScores && <th className="w-14">Score</th>}
                {showEmailCol && <th>E-post</th>}
                {showCol("phone") && <th className="cv-phone-cell">Tlf</th>}
                {showCol("website") && <th>Nettside</th>}
                {showCol("facebook") && <th>Facebook</th>}
                {showCol("instagram") && <th>Instagram</th>}
                {showCol("linkedin") && <th>LinkedIn</th>}
                {showCol("ceo") && <th>Daglig leder</th>}
                {showCol("status") && <th>Status</th>}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const scan = websiteScans?.get(c.orgnr);
                const status = c.user_lead?.status ?? "ny";
                const isScanning = scanningOrgnrs?.has(c.orgnr);
                const isSelected = selected.has(c.orgnr);
                const score = queueScores?.get(c.orgnr);

                return (
                  <tr key={c.orgnr} className={cn("group", isSelected && "is-selected")}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(c.orgnr)}
                        aria-label={`Velg ${c.name}`}
                        className="cv-checkbox h-3.5 w-3.5 rounded accent-sky-600"
                      />
                    </td>
                    <td>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CompanyNameButton
                            company={c}
                            onGoogleSearch={openGoogleSearch}
                            className="max-w-[14rem]"
                          />
                          <p className="cv-meta max-w-[16rem] truncate">
                            {[
                              c.municipality_name,
                              c.registered_at
                                ? formatRegisteredDate(c.registered_at)
                                : null,
                              c.orgnr,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <RowQuickActions
                          company={c}
                          onQuickQueue={onQuickQueue}
                          onQuickEmail={onQuickEmail}
                          onQuickCheckWebsite={onQuickCheckWebsite}
                        />
                      </div>
                    </td>
                    {queueScores && (
                      <td className="tabular-nums">
                        {score != null ? (
                          <span
                            className={cn(
                              "cv-score-badge inline-flex min-w-[2rem] justify-center rounded px-1.5 py-0.5 text-[11px] font-bold",
                              score >= 80
                                ? "bg-emerald-500/20 text-emerald-200"
                                : score >= 50
                                  ? "bg-amber-500/20 text-amber-100"
                                  : "bg-white/10 text-slate-300"
                            )}
                            title={`Score ${score}: ${explainQueueScore(
                              c,
                              c.user_lead ?? null,
                              scan ?? null
                            )}`}
                          >
                            {score}
                          </span>
                        ) : (
                          <span className="cv-muted text-[11px]">—</span>
                        )}
                      </td>
                    )}
                    {showEmailCol && (
                      <td className="max-w-[12rem]">
                        {(() => {
                          const resolved = resolveCompanyEmail(c, scan);
                          return resolved ? (
                            <EmailCell resolved={resolved} />
                          ) : (
                            <span className="cv-muted">—</span>
                          );
                        })()}
                      </td>
                    )}
                    {showCol("phone") && (
                      <td className="cv-phone-cell whitespace-nowrap">
                        <PhoneCell company={c} scan={scan} />
                      </td>
                    )}
                    {showCol("website") && (
                      <td className="max-w-[11rem]">
                        <div className="inline-flex max-w-full flex-wrap items-center gap-0.5">
                          <WebsiteCell
                            scan={scan}
                            scanning={isScanning}
                            companyName={c.name}
                          />
                          {scan && !isScanning && (
                            <>
                              {scan.hasWebsite && (
                                <PresenceBadge kind="ok" label="Web" />
                              )}
                              {!scan.hasWebsite &&
                                scan.websiteKind === "none" &&
                                scan.confidence !== "low" && (
                                  <PresenceBadge kind="warn" label="Uten" />
                                )}
                              <GulesiderBadge scan={scan} scanning={isScanning} />
                            </>
                          )}
                        </div>
                      </td>
                    )}
                    {showCol("facebook") && (
                      <td className="max-w-[7rem]">
                        <div className="inline-flex max-w-full flex-wrap items-center gap-0.5">
                          <SocialCell
                            scanning={!!isScanning}
                            url={scan?.facebookUrl}
                            confidence={scan?.facebookConfidence}
                            scanned={Boolean(scan?.socialScan?.includeFacebook)}
                            icon={
                              <FacebookIcon className="h-3 w-3 shrink-0 text-blue-700" />
                            }
                            label={scan?.facebookProfile?.name ?? "FB"}
                          />
                          {scan?.facebookUrl && !isScanning && (
                            <PresenceBadge kind="info" label="FB" />
                          )}
                          {scan?.socialScan?.includeFacebook &&
                            !scan.facebookUrl &&
                            !isScanning && <PresenceBadge kind="muted" label="Nei" />}
                        </div>
                      </td>
                    )}
                    {showCol("instagram") && (
                      <td className="max-w-[7rem]">
                        <div className="inline-flex max-w-full flex-wrap items-center gap-0.5">
                          <SocialCell
                            scanning={!!isScanning}
                            url={scan?.instagramUrl}
                            confidence={scan?.instagramConfidence}
                            scanned={Boolean(scan?.socialScan?.includeInstagram)}
                            icon={
                              <InstagramIcon className="h-3 w-3 shrink-0 text-pink-700" />
                            }
                            label={
                              scan?.instagramProfile?.username ??
                              scan?.instagramProfile?.name ??
                              "IG"
                            }
                            viaFb={scan?.instagramFromFacebook}
                          />
                          {scan?.instagramUrl && !isScanning && (
                            <PresenceBadge kind="info" label="IG" />
                          )}
                          {scan?.socialScan?.includeInstagram &&
                            !scan.instagramUrl &&
                            !isScanning && <PresenceBadge kind="muted" label="Nei" />}
                        </div>
                      </td>
                    )}
                    {showCol("linkedin") && (
                      <td className="max-w-[7rem]">
                        <div className="inline-flex max-w-full flex-wrap items-center gap-0.5">
                          <SocialCell
                            scanning={!!isScanning}
                            url={scan?.linkedinUrl}
                            confidence={scan?.linkedinConfidence}
                            scanned={Boolean(scan?.socialScan?.includeLinkedIn)}
                            icon={
                              <LinkedinIcon className="h-3 w-3 shrink-0 text-sky-800" />
                            }
                            label="LI"
                            viaFb={scan?.linkedinFromFacebook}
                            viaWebsite={scan?.linkedinFromWebsite}
                          />
                          {scan?.linkedinUrl && !isScanning && (
                            <PresenceBadge kind="info" label="LI" />
                          )}
                          {scan?.socialScan?.includeLinkedIn &&
                            !scan.linkedinUrl &&
                            !isScanning && <PresenceBadge kind="muted" label="Nei" />}
                        </div>
                      </td>
                    )}
                    {showCol("ceo") && (
                      <td
                        className="max-w-[8rem] truncate text-xs"
                        title={c.daglig_leder ?? undefined}
                      >
                        {c.daglig_leder ?? <span className="cv-muted">—</span>}
                      </td>
                    )}
                    {showCol("status") && (
                      <td>
                        {onStatusChange ? (
                          <select
                            value={status}
                            onChange={(e) => onStatusChange(c.orgnr, e.target.value)}
                            className="cv-status-select"
                          >
                            {LEAD_STATUSES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <StatusPill status={status} label={statusLabel(status)} />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
