"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LEAD_STATUSES, statusLabel } from "@/lib/sales/constants";
import type { CompanyWithLead } from "@/types/database";
import type { WebsiteScanResult } from "@/lib/website-scan/types";
import {
  resolveCompanyEmail,
  type ResolvedCompanyEmail,
} from "@/lib/website-scan/resolve-company-email";
import { hasUncertainWebsiteHits, displayNameDiffersFromLegal } from "@/lib/website-scan/parse-results";
import { StatusPill, EmptyState } from "@/components/ui/primitives";
import { cn, formatRegisteredDate } from "@/lib/utils";
import { Globe, Globe2, HelpCircle, X } from "lucide-react";

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
};

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
    </a>
  );
}

function SocialCell({
  scanning,
  url,
  icon,
  label,
  viaFb,
  confidence,
  scanned,
}: {
  scanning: boolean;
  url?: string | null;
  icon: ReactNode;
  label: string;
  viaFb?: boolean;
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
}: {
  company: CompanyWithLead;
  scan?: WebsiteScanResult;
  isScanning?: boolean;
  onStatusChange?: (orgnr: string, status: string) => void;
}) {
  const status = c.user_lead?.status ?? "ny";
  const resolved = resolveCompanyEmail(c, scan);
  const phone = c.phone ?? c.mobile;

  return (
    <dl className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <DetailRow label="Firma">
        <p className="cv-firma font-semibold" id="company-detail-title">
          {c.name}
        </p>
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
        {phone ? (
          <a href={`tel:${phone}`} className="cv-link">
            {phone}
          </a>
        ) : (
          <span className="cv-muted">—</span>
        )}
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
            </>
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
}: {
  company: CompanyWithLead;
  scan?: WebsiteScanResult;
  isScanning?: boolean;
  onClose: () => void;
  onStatusChange?: (orgnr: string, status: string) => void;
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
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Lukk bedriftsinfo"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-detail-title"
        className="absolute bottom-0 left-0 right-0 max-h-[min(88vh,100dvh)] overflow-y-auto rounded-t-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--cv-border)] bg-white px-4 py-3">
          <p className="text-sm font-semibold text-[var(--cv-text)]">Bedriftsinfo</p>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
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
}: {
  company: CompanyWithLead;
  scan?: WebsiteScanResult;
  isScanning?: boolean;
  isSelected: boolean;
  onToggle: (orgnr: string) => void;
  onOpenDetail: (orgnr: string) => void;
  onStatusChange?: (orgnr: string, status: string) => void;
}) {
  const status = c.user_lead?.status ?? "ny";
  const resolved = resolveCompanyEmail(c, scan);
  const phone = c.phone ?? c.mobile;

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
        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded accent-sky-600"
      />
      <div className="min-w-0 flex-1">
        <div
          role="button"
          tabIndex={0}
          className="w-full min-w-0 cursor-pointer rounded-md text-left outline-none ring-sky-500 focus-visible:ring-2"
          onClick={() => onOpenDetail(c.orgnr)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenDetail(c.orgnr);
            }
          }}
          aria-label={`Vis detaljer for ${c.name}`}
        >
          <p className="cv-firma truncate text-[13px]" title={c.name}>
            {c.name}
          </p>
          {(c.municipality_name || c.registered_at) && (
            <p className="cv-meta truncate text-[11px]">
              {c.municipality_name ?? "—"}
              {c.registered_at && ` · ${formatRegisteredDate(c.registered_at)}`}
            </p>
          )}
          <p className="cv-mono mt-0.5 text-[11px]">{c.orgnr}</p>
          <div className="mt-1 min-w-0 text-[12px]" onClick={(e) => e.stopPropagation()}>
            {resolved ? (
              <EmailCell resolved={resolved} />
            ) : phone ? (
              <a
                href={`tel:${phone}`}
                className="cv-link"
                onClick={(e) => e.stopPropagation()}
              >
                {phone}
              </a>
            ) : (
              <span className="cv-muted">Ingen kontakt</span>
            )}
          </div>
          <div
            className="mt-1 flex flex-wrap items-center gap-1 text-[12px]"
            onClick={(e) => e.stopPropagation()}
          >
            <WebsiteCell scan={scan} scanning={isScanning} companyName={c.name} />
            {scan && !isScanning && (
              <>
                {scan.hasWebsite && <PresenceBadge kind="ok" label="Web" />}
                {!scan.hasWebsite &&
                  scan.websiteKind === "none" &&
                  scan.confidence !== "low" && <PresenceBadge kind="warn" label="Uten" />}
              </>
            )}
            {scan?.facebookUrl && !isScanning && (
              <a
                href={scan.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-blue-700"
                title="Facebook"
                onClick={(e) => e.stopPropagation()}
              >
                <FacebookIcon className="h-3 w-3 shrink-0" />
                <span className="text-[11px]">FB</span>
              </a>
            )}
          </div>
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
}: Props) {
  const [detailOrgnr, setDetailOrgnr] = useState<string | null>(null);
  const detailCompany =
    detailOrgnr != null ? companies.find((c) => c.orgnr === detailOrgnr) : undefined;

  if (companies.length === 0) {
    return (
      <EmptyState
        title="Ingen firma funnet"
        description={
          liveBrreg
            ? "Prøv lengre periode, fjern «kun post@ / info@», eller velg en annen kommune."
            : "Prøv et annet område eller kjør sync fra admin."
        }
      />
    );
  }

  return (
    <>
      <div className="nylead-theme-compact-table md:hidden">
        <div className="flex items-center gap-2 border-b border-[var(--cv-border)] bg-[var(--cv-surface)] px-3 py-1.5">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            aria-label="Velg alle"
            className="h-3.5 w-3.5 rounded accent-sky-600"
          />
          <span className="text-[11px] font-semibold text-[var(--cv-muted)]">Velg alle</span>
        </div>
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
          />
        ))}
      </div>

      {detailCompany && (
        <CompanyMobileDetailSheet
          company={detailCompany}
          scan={websiteScans?.get(detailCompany.orgnr)}
          isScanning={scanningOrgnrs?.has(detailCompany.orgnr)}
          onClose={() => setDetailOrgnr(null)}
          onStatusChange={onStatusChange}
        />
      )}

      <div className="nylead-theme-compact-table hidden w-full overflow-x-auto md:block">
      <table className="nylead-compact-table w-full min-w-[880px]">
        <thead>
          <tr>
            <th className="w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Velg alle"
                className="h-3.5 w-3.5 rounded accent-sky-600"
              />
            </th>
            <th>Firma</th>
            <th>Org.nr</th>
            <th>E-post</th>
            <th>Tlf</th>
            <th>Nettside</th>
            <th>Facebook</th>
            <th>Instagram</th>
            <th>Daglig leder</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => {
            const scan = websiteScans?.get(c.orgnr);
            const status = c.user_lead?.status ?? "ny";
            const isScanning = scanningOrgnrs?.has(c.orgnr);
            const isSelected = selected.has(c.orgnr);

            return (
              <tr key={c.orgnr} className={cn(isSelected && "is-selected")}>
                <td>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(c.orgnr)}
                    aria-label={`Velg ${c.name}`}
                    className="h-3.5 w-3.5 rounded accent-sky-600"
                  />
                </td>
                <td>
                  <p className="cv-firma max-w-[14rem] truncate" title={c.name}>
                    {c.name}
                  </p>
                  {(c.municipality_name || c.registered_at) && (
                    <p className="cv-meta max-w-[14rem] truncate">
                      {c.municipality_name ?? "—"}
                      {c.registered_at && ` · ${formatRegisteredDate(c.registered_at)}`}
                    </p>
                  )}
                </td>
                <td className="cv-mono whitespace-nowrap">{c.orgnr}</td>
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
                <td className="whitespace-nowrap">
                  {c.phone ?? c.mobile ? (
                    <a href={`tel:${c.phone ?? c.mobile}`} className="cv-link">
                      {c.phone ?? c.mobile}
                    </a>
                  ) : (
                    <span className="cv-muted">—</span>
                  )}
                </td>
                <td className="max-w-[11rem]">
                  <div className="inline-flex max-w-full flex-wrap items-center gap-0.5">
                    <WebsiteCell scan={scan} scanning={isScanning} companyName={c.name} />
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
                      </>
                    )}
                  </div>
                </td>
                <td className="max-w-[7rem]">
                  <div className="inline-flex max-w-full flex-wrap items-center gap-0.5">
                    <SocialCell
                      scanning={!!isScanning}
                      url={scan?.facebookUrl}
                      confidence={scan?.facebookConfidence}
                      scanned={Boolean(scan?.socialScan?.includeFacebook)}
                      icon={<FacebookIcon className="h-3 w-3 shrink-0 text-blue-700" />}
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
                <td className="max-w-[7rem]">
                  <div className="inline-flex max-w-full flex-wrap items-center gap-0.5">
                    <SocialCell
                      scanning={!!isScanning}
                      url={scan?.instagramUrl}
                      confidence={scan?.instagramConfidence}
                      scanned={Boolean(scan?.socialScan?.includeInstagram)}
                      icon={<InstagramIcon className="h-3 w-3 shrink-0 text-pink-700" />}
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
                <td className="max-w-[8rem] truncate text-xs text-slate-700" title={c.daglig_leder ?? undefined}>
                  {c.daglig_leder ?? <span className="cv-muted">—</span>}
                </td>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
