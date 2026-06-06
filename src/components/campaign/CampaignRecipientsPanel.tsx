"use client";

import { useState } from "react";
import type { Company } from "@/types/database";
import type { ResolvedCompanyEmail } from "@/lib/website-scan/resolve-company-email";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

type RecipientRow = {
  company: Company;
  resolved: ResolvedCompanyEmail;
};

type Props = {
  recipients: RecipientRow[];
  skipped: Company[];
  light?: boolean;
};

function sourceLabel(source: ResolvedCompanyEmail["source"]) {
  if (source === "facebook") return "Facebook";
  if (source === "instagram") return "Instagram";
  return "Brreg";
}

export function CampaignRecipientsPanel({ recipients, skipped, light = true }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div
      className={cn(
        "rounded-lg border text-sm",
        light ? "border-slate-200 bg-slate-50/80" : "border-white/10 bg-white/[0.02]"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold",
          light ? "text-slate-800" : "text-white/90"
        )}
      >
        <span>
          Mottakere ({recipients.length})
          {skipped.length > 0 && (
            <span className={cn("ml-1.5 font-normal", light ? "text-slate-500" : "text-white/45")}>
              · {skipped.length} hoppes over
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 opacity-60" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        )}
      </button>

      {open && (
        <div
          className={cn(
            "max-h-48 space-y-1 overflow-y-auto border-t px-3 py-2",
            light ? "border-slate-200/80" : "border-white/10"
          )}
        >
          {recipients.map(({ company, resolved }) => (
            <div
              key={company.orgnr}
              className={cn(
                "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded px-1 py-1 text-xs",
                light ? "text-slate-700" : "text-white/75"
              )}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{company.name}</span>
              <span className={cn("shrink-0", light ? "text-slate-500" : "text-white/45")}>
                {resolved.email}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                  light ? "bg-slate-200 text-slate-600" : "bg-white/10 text-white/50"
                )}
              >
                {sourceLabel(resolved.source)}
              </span>
              {resolved.isPersonal && (
                <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-200">
                  personlig
                </span>
              )}
              {resolved.isGeneric && !resolved.isPersonal && (
                <span className="shrink-0 rounded bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  generisk
                </span>
              )}
            </div>
          ))}

          {skipped.length > 0 && (
            <div className={cn("mt-2 border-t pt-2", light ? "border-slate-200/60" : "border-white/10")}>
              <p className={cn("mb-1 text-[10px] font-semibold uppercase tracking-wide", light ? "text-slate-400" : "text-white/35")}>
                Uten e-post (hoppes over)
              </p>
              {skipped.map((c) => (
                <p
                  key={c.orgnr}
                  className={cn("truncate px-1 py-0.5 text-xs", light ? "text-slate-400" : "text-white/35")}
                >
                  {c.name}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
