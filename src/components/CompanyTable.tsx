"use client";

import { LEAD_STATUSES, statusLabel } from "@/lib/sales/constants";
import { isPersonalEmail } from "@/lib/brreg/map-company";
import type { CompanyWithLead } from "@/types/database";
import type { WebsiteScanResult } from "@/lib/website-scan/types";
import { hasUncertainWebsiteHits } from "@/lib/website-scan/parse-results";
import {
  computeWebsiteBadnessScore,
  websiteBadnessLabel,
} from "@/lib/website-scan/website-badness-score";
import { ScoreRing, StatusPill, EmptyState } from "@/components/ui/primitives";
import { cn, formatRegisteredDate } from "@/lib/utils";
import { Globe, Globe2, HelpCircle } from "lucide-react";

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
  light?: boolean;
};

function WebsiteBadge({
  scan,
  scanning,
  companyName,
  light = false,
}: {
  scan?: WebsiteScanResult;
  scanning?: boolean;
  companyName: string;
  light?: boolean;
}) {
  if (scanning) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px]",
          light ? "text-slate-400" : "text-white/40"
        )}
      >
        <span className="h-3 w-3 animate-pulse rounded-full bg-brand-gold/50" />
        Sjekker…
      </span>
    );
  }
  if (!scan) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px]",
          light ? "text-slate-300" : "text-white/30"
        )}
        title="Ikke skannet"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        —
      </span>
    );
  }
  if (scan.hasWebsite) {
    return (
      <a
        href={scan.websiteUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex max-w-full items-center gap-1 truncate text-[11px] hover:underline",
          light ? "text-emerald-600" : "text-emerald-300"
        )}
        title={scan.websiteUrl ?? scan.websiteDomain ?? "Har nettside"}
      >
        <Globe2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{scan.websiteDomain ?? "Ja"}</span>
      </a>
    );
  }
  if (scan.websiteKind === "booking_only" && scan.confidence !== "low") {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1 truncate text-[11px] font-semibold",
          light ? "text-amber-700" : "text-amber-200"
        )}
        title={`Kun booking (${scan.bookingPlatform ?? "Timma/Fixit"}) — ingen egen nettside`}
      >
        <Globe className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Kun booking</span>
      </span>
    );
  }
  if (hasUncertainWebsiteHits(scan.topHits, companyName)) {
    const hint = scan.topHits?.find((h) => h.domain)?.domain ?? "mulig treff";
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1 truncate text-[11px] font-semibold",
          light ? "text-sky-600" : "text-sky-300"
        )}
        title={`Google viste noe (${hint}) — sjekk selv om det er deres side`}
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Usikker</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold",
        light ? "text-amber-700" : "text-brand-gold"
      )}
      title="Ingen nettside funnet — god kandidat for tilbud"
    >
      <Globe className="h-3.5 w-3.5" />
      Ingen nettside
    </span>
  );
}

function EmailCell({ email, light = false }: { email: string; light?: boolean }) {
  const personal = isPersonalEmail(email);
  return (
    <span
      className={cn(
        "block truncate",
        personal
          ? light
            ? "text-amber-700"
            : "text-amber-300"
          : light
            ? "text-brand-navy"
            : "text-brand-gold"
      )}
      title={email}
    >
      {email}
      {personal && (
        <span
          className={cn(
            "ml-1 whitespace-nowrap text-[10px]",
            light ? "text-amber-600/80" : "text-amber-300/70"
          )}
        >
          (personlig)
        </span>
      )}
    </span>
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
  light = false,
}: Props) {
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
      {/* Mobil + nettbrett: kort */}
      <div className="space-y-3 lg:hidden">
        <div className="flex items-center justify-between px-1">
          <label
            className={cn(
              "flex items-center gap-2 text-xs font-medium",
              light ? "text-slate-500" : "font-sans text-white/50"
            )}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleAll}
              className="h-4 w-4 rounded accent-brand-gold"
            />
            Velg alle med e-post
          </label>
          <span className={cn("text-xs", light ? "text-slate-400" : "font-sans text-white/40")}>
            {companies.length} firma
          </span>
        </div>

        {companies.map((c) => {
          const scan = websiteScans?.get(c.orgnr);
          const score = computeWebsiteBadnessScore(scan, c.name);
          const status = c.user_lead?.status ?? "ny";

          return (
            <div
              key={c.orgnr}
              className={cn(
                light
                  ? "rounded-xl border border-white/60 bg-white/50 p-4 shadow-sm backdrop-blur-md"
                  : "panel p-4",
                selected.has(c.orgnr) &&
                  (light ? "border-brand-gold/50 ring-1 ring-brand-gold/20" : "border-brand-gold/40")
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(c.orgnr)}
                  onChange={() => onToggle(c.orgnr)}
                  disabled={!c.has_email}
                  className="mt-1 h-4 w-4 shrink-0 rounded accent-brand-gold"
                />
                <ScoreRing
                  score={score}
                  size="sm"
                  light={light}
                  title={websiteBadnessLabel(score)}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-snug",
                      light ? "text-slate-900" : "font-sans text-white"
                    )}
                  >
                    {c.name}
                  </p>
                  <p className={cn("font-mono text-[11px]", light ? "text-slate-400" : "text-white/40")}>
                    {c.orgnr}
                  </p>
                  <p className={cn("mt-0.5 text-xs", light ? "text-slate-500" : "text-white/50")}>
                    {c.municipality_name} · {formatRegisteredDate(c.registered_at)}
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "mt-3 space-y-2 border-t pt-3",
                  light ? "border-slate-100" : "border-white/[0.06]"
                )}
              >
                <WebsiteBadge
                  scan={scan}
                  scanning={scanningOrgnrs?.has(c.orgnr)}
                  companyName={c.name}
                  light={light}
                />
                {c.email ? (
                  <EmailCell email={c.email} light={light} />
                ) : (
                  <p className={cn("text-xs", light ? "text-slate-400" : "text-white/30")}>
                    Ingen e-post
                  </p>
                )}
                {(c.phone ?? c.mobile) && (
                  <p className={cn("text-xs", light ? "text-slate-500" : "text-white/50")}>
                    {c.phone ?? c.mobile}
                  </p>
                )}
                {onStatusChange ? (
                  <select
                    value={status}
                    onChange={(e) => onStatusChange(c.orgnr, e.target.value)}
                    className={
                      light
                        ? "scan-input py-2 text-xs"
                        : "w-full rounded-md border border-white/10 bg-brand-navyDark px-2 py-2 text-xs text-white"
                    }
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
          );
        })}
      </div>

      {/* PC: tabell med synlig e-post */}
      <div
        className={cn(
          "hidden overflow-hidden lg:block",
          !light && "panel"
        )}
      >
        <p
          className={cn(
            "border-b px-4 py-2 text-[11px]",
            light
              ? "border-white/50 bg-white/40 text-slate-400 backdrop-blur-sm"
              : "border-white/[0.06] bg-brand-navy/80 font-sans text-white/35"
          )}
        >
          Scroll horisontalt for flere kolonner
        </p>
        <div
          className={cn(
            "app-scroll overflow-x-auto",
            light ? "bg-white/30 backdrop-blur-sm" : "bg-brand-navyDark"
          )}
        >
          <table
            className={cn(
              "w-full min-w-[1080px] table-fixed text-left text-sm",
              light ? "bg-transparent" : "bg-brand-navyDark"
            )}
          >
            <colgroup>
              <col className="w-10" />
              <col className="w-14" />
              <col className="w-[min(220px,22vw)]" />
              <col className="w-[min(240px,26vw)]" />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-24" />
              <col className="w-36" />
              <col className="w-32" />
            </colgroup>
            <thead
              className={cn(
                "border-b text-[11px] font-semibold",
                light
                  ? "border-white/50 bg-white/45 text-slate-500 backdrop-blur-md"
                  : "border-white/[0.06] bg-brand-navy font-bold uppercase tracking-wider text-white/50"
              )}
            >
              <tr>
                <th
                  className={cn(
                    "sticky left-0 z-10 px-3 py-3.5",
                    light ? "bg-white/45" : "bg-brand-navy"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    aria-label="Velg alle"
                    className="rounded accent-brand-gold"
                  />
                </th>
                <th
                  className="px-2 py-3.5"
                  title="0 = ingen nettside. Høyere tall = dårligere nettside."
                >
                  Nett
                </th>
                <th className={cn("sticky left-10 z-10 px-3 py-3.5", light ? "bg-white/45" : "bg-brand-navy")}>
                  Navn
                </th>
                <th className={cn("px-3 py-3.5", light ? "bg-white/45" : "bg-brand-navy")}>E-post</th>
                <th className={cn("px-3 py-3.5", light ? "bg-white/45" : "bg-brand-navy")}>Nettside</th>
                <th className={cn("px-3 py-3.5", light ? "bg-white/45" : "bg-brand-navy")}>Telefon</th>
                <th className={cn("px-3 py-3.5", light ? "bg-white/45" : "bg-brand-navy")}>Registrert</th>
                <th className={cn("px-3 py-3.5", light ? "bg-white/45" : "bg-brand-navy")}>Kommune</th>
                <th className={cn("px-3 py-3.5", light ? "bg-white/45" : "bg-brand-navy")}>Status</th>
              </tr>
            </thead>
            <tbody className={light ? "bg-transparent" : "bg-brand-navyDark"}>
              {companies.map((c) => {
                const scan = websiteScans?.get(c.orgnr);
                const score = computeWebsiteBadnessScore(scan, c.name);
                const status = c.user_lead?.status ?? "ny";
                const rowBg = light ? "bg-white/40" : "bg-brand-navyDark";
                const rowHover = light ? "hover:bg-white/60" : "hover:bg-brand-navy/80";
                return (
                  <tr
                    key={c.orgnr}
                    className={cn(
                      "border-t transition",
                      light ? "border-slate-100" : "border-white/[0.04]",
                      rowBg,
                      rowHover,
                      selected.has(c.orgnr) && light && "bg-amber-50/50"
                    )}
                  >
                    <td className={cn("sticky left-0 z-10 px-3 py-3", rowBg)}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.orgnr)}
                        onChange={() => onToggle(c.orgnr)}
                        disabled={!c.has_email}
                        aria-label={`Velg ${c.name}`}
                        className="rounded accent-brand-gold"
                      />
                    </td>
                    <td className={cn("px-2 py-3", rowBg)}>
                      <ScoreRing
                        score={score}
                        size="sm"
                        light={light}
                        title={websiteBadnessLabel(score)}
                      />
                    </td>
                    <td className={cn("sticky left-10 z-10 px-3 py-3", rowBg)}>
                      <p
                        className={cn("truncate font-medium", light ? "text-slate-900" : "text-white")}
                        title={c.name}
                      >
                        {c.name}
                      </p>
                      <p
                        className={cn(
                          "truncate font-mono text-[10px]",
                          light ? "text-slate-400" : "text-white/40"
                        )}
                      >
                        {c.orgnr}
                      </p>
                    </td>
                    <td className={cn("px-3 py-3", rowBg)}>
                      {c.email ? (
                        <EmailCell email={c.email} light={light} />
                      ) : (
                        <span className={light ? "text-slate-300" : "text-white/40"}>—</span>
                      )}
                    </td>
                    <td className={cn("px-3 py-3", rowBg)}>
                      <WebsiteBadge
                        scan={scan}
                        scanning={scanningOrgnrs?.has(c.orgnr)}
                        companyName={c.name}
                        light={light}
                      />
                    </td>
                    <td
                      className={cn(
                        "truncate px-3 py-3",
                        rowBg,
                        light ? "text-slate-600" : "text-white/50"
                      )}
                    >
                      {c.phone ?? c.mobile ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-3",
                        rowBg,
                        light ? "text-slate-600" : "text-white/50"
                      )}
                    >
                      {formatRegisteredDate(c.registered_at)}
                    </td>
                    <td
                      className={cn(
                        "truncate px-3 py-3",
                        rowBg,
                        light ? "text-slate-600" : "text-white/50"
                      )}
                      title={c.municipality_name ?? ""}
                    >
                      {c.municipality_name ?? "—"}
                    </td>
                    <td className={cn("px-3 py-3", rowBg)}>
                      {onStatusChange ? (
                        <select
                          value={status}
                          onChange={(e) => onStatusChange(c.orgnr, e.target.value)}
                          className={
                            light
                              ? "scan-input max-w-[7.5rem] py-1 text-xs"
                              : "w-full max-w-[7.5rem] rounded-lg border border-white/10 bg-brand-navyDark px-2 py-1 text-xs text-white"
                          }
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
      </div>
    </>
  );
}
