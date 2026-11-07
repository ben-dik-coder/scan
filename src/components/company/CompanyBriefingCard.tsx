"use client";

import { buildCompanyBriefing } from "@/lib/company-briefing/build-briefing";
import type { CompanyBriefingItem } from "@/lib/company-briefing/types";
import type { WebsiteScanResult } from "@/lib/website-scan/types";
import { cn } from "@/lib/utils";
import { Check, CircleHelp, Lightbulb, X } from "lucide-react";
import { useMemo } from "react";

type CompanyLike = {
  name: string;
  industry_code?: string | null;
  industry_description?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  has_email?: boolean;
};

function StatusIcon({ status }: { status: CompanyBriefingItem["status"] }) {
  if (status === "ok") {
    return <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />;
  }
  if (status === "missing") {
    return <X className="h-3.5 w-3.5 text-amber-300" aria-hidden />;
  }
  if (status === "tip") {
    return <Lightbulb className="h-3.5 w-3.5 text-sky-300" aria-hidden />;
  }
  return <CircleHelp className="h-3.5 w-3.5 text-zinc-500" aria-hidden />;
}

function statusLabel(status: CompanyBriefingItem["status"]): string {
  if (status === "ok") return "På plass";
  if (status === "missing") return "Mangler";
  if (status === "tip") return "Ofte behov";
  return "Ukjent";
}

export function CompanyBriefingCard({
  company,
  scan,
  compact = false,
  className,
}: {
  company: CompanyLike;
  scan?: WebsiteScanResult | null;
  compact?: boolean;
  className?: string;
}) {
  const briefing = useMemo(
    () => buildCompanyBriefing(company, scan),
    [company, scan]
  );

  const checklist = compact
    ? briefing.checklist.filter((i) => i.status === "missing" || i.status === "tip").slice(0, 5)
    : briefing.checklist;

  return (
    <section
      className={cn(
        "rounded-2xl border border-white/[0.1] bg-white/[0.03]",
        className
      )}
      aria-label="Hva de driver med"
    >
      <div className="border-b border-white/[0.08] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Hva de driver med
        </p>
        <h3 className="mt-1 text-base font-semibold leading-snug text-white">
          {briefing.headline}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          {briefing.summary}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] text-zinc-300">
            {briefing.verticalLabel}
          </span>
          {briefing.naceCode ? (
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
              NACE {briefing.naceCode}
            </span>
          ) : null}
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Sjekkliste — mangler & typiske behov
        </p>
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  <StatusIcon status={item.status} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-medium text-zinc-100">{item.label}</p>
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wide",
                        item.status === "missing" && "text-amber-300/90",
                        item.status === "ok" && "text-emerald-400/90",
                        item.status === "tip" && "text-sky-300/90",
                        item.status === "unknown" && "text-zinc-500"
                      )}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  {!compact ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                      {item.why}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Én linje under firmanavn i lister. */
export function CompanyBriefingOneLiner({
  company,
  className,
}: {
  company: CompanyLike;
  className?: string;
}) {
  const briefing = useMemo(() => buildCompanyBriefing(company), [company]);
  return (
    <p className={cn("truncate text-[12px] text-zinc-400", className)} title={briefing.headline}>
      {briefing.headline}
    </p>
  );
}
