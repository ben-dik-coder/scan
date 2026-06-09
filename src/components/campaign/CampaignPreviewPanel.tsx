"use client";

import type { Company } from "@/types/database";
import { buildCampaignVars } from "@/lib/email/campaign-vars";
import { renderTemplate } from "@/lib/email/utils";
import { cn, formatCompanyName } from "@/lib/utils";

type Props = {
  companies: Company[];
  previewOrgnr: string;
  onPreviewOrgnrChange: (orgnr: string) => void;
  subject: string;
  body: string;
  light?: boolean;
  testLoading?: boolean;
  testResult?: string | null;
  testError?: string | null;
  onSendTest?: () => void;
  canSendTest?: boolean;
};

export function CampaignPreviewPanel({
  companies,
  previewOrgnr,
  onPreviewOrgnrChange,
  subject,
  body,
  light = true,
  testLoading = false,
  testResult = null,
  testError = null,
  onSendTest,
  canSendTest = false,
}: Props) {
  const previewCompany = companies.find((c) => c.orgnr === previewOrgnr) ?? companies[0];
  const vars = previewCompany
    ? buildCampaignVars(previewCompany)
    : { firmanavn: "", orgnr: "" };

  const renderedSubject = renderTemplate(subject, vars);
  const renderedBody = renderTemplate(body, vars);

  const labelClass = light ? "font-medium text-slate-600" : "font-semibold text-white/70";
  const inputClass = light ? "scan-input mt-1.5" : "input-dark mt-1.5 py-2.5";

  return (
    <div className="space-y-3">
      {companies.length > 1 && (
        <label className="block text-sm">
          <span className={labelClass}>Forhåndsvis for</span>
          <select
            value={previewOrgnr}
            onChange={(e) => onPreviewOrgnrChange(e.target.value)}
            className={inputClass}
          >
            {companies.map((c) => (
              <option key={c.orgnr} value={c.orgnr}>
                {formatCompanyName(c.name)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div
        className={cn(
          "rounded-lg border p-3 text-sm",
          light ? "border-slate-200 bg-white" : "border-white/10 bg-white/[0.03]"
        )}
      >
        <p className={cn("text-[10px] font-semibold uppercase tracking-wide", light ? "text-slate-400" : "text-white/35")}>
          Forhåndsvisning
        </p>
        <p className={cn("mt-2 font-semibold", light ? "text-slate-900" : "text-white")}>
          {renderedSubject || "(tomt emne)"}
        </p>
        <pre
          className={cn(
            "mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed",
            light ? "text-slate-600" : "text-white/60"
          )}
        >
          {renderedBody || "(tom melding)"}
        </pre>
      </div>

      {onSendTest && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onSendTest}
            disabled={testLoading || !canSendTest}
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-50",
              light
                ? "border-slate-200 bg-white text-slate-700 hover:border-brand-gold/40"
                : "border-white/15 bg-white/5 text-white/80 hover:border-brand-gold/30"
            )}
          >
            {testLoading ? "Sender test…" : "Send test til meg"}
          </button>
          {testResult && (
            <p className={light ? "text-xs text-emerald-600" : "text-xs text-brand-gold"}>
              {testResult}
            </p>
          )}
          {testError && <p className="text-xs text-red-600">{testError}</p>}
        </div>
      )}
    </div>
  );
}
