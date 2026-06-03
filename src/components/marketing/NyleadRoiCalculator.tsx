"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calculator, Clock, Coins, TrendingUp } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ROI_CALCULATOR } from "@/content/landing";
import { NYLEAD_PLAN } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type SliderConfig = {
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  hint?: string;
};

function formatNok(value: number): string {
  return `${Math.round(value).toLocaleString("nb-NO")} kr`;
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h} t`;
  return `${h} t ${m} min`;
}

function calcRoi(
  researchHoursPerWeek: number,
  hourlyRate: number,
  leadsPerMonth: number,
  proffSubscription: number
) {
  const {
    manualMinutesPerLead,
    nyleadMinutesPerLead,
    weeksPerMonth,
    nyleadResearchHoursPerWeek,
    planPriceNok,
  } = ROI_CALCULATOR;

  const manualLeadHours = (leadsPerMonth * manualMinutesPerLead) / 60;
  const manualResearchHours = researchHoursPerWeek * weeksPerMonth;
  const manualTotalHours = manualLeadHours + manualResearchHours;

  const nyleadLeadHours = (leadsPerMonth * nyleadMinutesPerLead) / 60;
  const nyleadResearchHours = nyleadResearchHoursPerWeek * weeksPerMonth;
  const nyleadTotalHours = nyleadLeadHours + nyleadResearchHours;

  const manualLaborCost = manualTotalHours * hourlyRate;
  const nyleadLaborCost = nyleadTotalHours * hourlyRate;

  const manualTotalCost = manualLaborCost + proffSubscription;
  const nyleadTotalCost = nyleadLaborCost + planPriceNok;

  const monthlySavings = manualTotalCost - nyleadTotalCost;
  const hoursSaved = manualTotalHours - nyleadTotalHours;
  const roiPercent =
    monthlySavings > 0 ? (monthlySavings / planPriceNok) * 100 : 0;
  const paybackDays =
    monthlySavings > 0 ? Math.ceil((planPriceNok / monthlySavings) * 30) : null;

  return {
    manualTotalHours,
    nyleadTotalHours,
    manualTotalCost,
    nyleadTotalCost,
    monthlySavings,
    hoursSaved,
    roiPercent,
    paybackDays,
    manualLeadHours,
    manualResearchHours,
    nyleadLeadHours,
    nyleadResearchHours,
  };
}

function RangeSlider({
  id,
  config,
  value,
  onChange,
  formatValue,
}: {
  id: string;
  config: SliderConfig;
  value: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}) {
  const display = formatValue ? formatValue(value) : value.toLocaleString("nb-NO");
  const fillPercent = `${((value - config.min) / (config.max - config.min)) * 100}%`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-sans text-sm font-semibold text-brand-navy">
          {config.label}
        </label>
        <span className="font-display text-lg font-bold tabular-nums text-brand-gold">
          {display}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={config.min}
        max={config.max}
        step={config.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="roi-range w-full"
        style={{ ["--fill" as string]: fillPercent }}
      />
      <div className="flex justify-between font-sans text-[11px] font-medium text-slate-400">
        <span>{formatValue ? formatValue(config.min) : config.min}</span>
        <span>{formatValue ? formatValue(config.max) : config.max}</span>
      </div>
      {config.hint ? (
        <p className="font-sans text-xs leading-relaxed text-slate-500">{config.hint}</p>
      ) : null}
    </div>
  );
}

type Props = {
  embedded?: boolean;
};

export function NyleadRoiCalculator({ embedded = false }: Props) {
  const { sliders } = ROI_CALCULATOR;

  const [researchHours, setResearchHours] = useState(sliders.researchHours.default);
  const [hourlyRate, setHourlyRate] = useState(sliders.hourlyRate.default);
  const [leadsPerMonth, setLeadsPerMonth] = useState(sliders.leadsPerMonth.default);
  const [proffSubscription, setProffSubscription] = useState(
    sliders.proffSubscription.default
  );

  const result = useMemo(
    () => calcRoi(researchHours, hourlyRate, leadsPerMonth, proffSubscription),
    [researchHours, hourlyRate, leadsPerMonth, proffSubscription]
  );

  const planPrice = NYLEAD_PLAN.priceNok;

  return (
    <section
      id="besparelse"
      className={
        embedded
          ? "landing-section-embedded py-14 sm:py-20 md:py-28"
          : "border-t border-brand-border bg-white py-16 sm:py-24 md:py-32"
      }
    >
      <Container wide>
        <div className="mx-auto max-w-3xl text-center">
          <p className="type-eyebrow">{ROI_CALCULATOR.eyebrow}</p>
          <h2 className="type-h2 mt-3 text-brand-navy">{ROI_CALCULATOR.title}</h2>
          <p className="mt-4 font-sans text-base leading-relaxed text-slate-600">
            {ROI_CALCULATOR.subtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-5 lg:gap-10">
          {/* Inputs */}
          <div className="space-y-8 rounded-2xl border border-brand-border bg-brand-surface p-6 sm:p-8 lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-goldPale">
                <Calculator className="h-5 w-5 text-brand-gold" />
              </div>
              <p className="font-display text-sm font-bold uppercase tracking-wide text-brand-navy">
                Dine tall
              </p>
            </div>

            <RangeSlider
              id="research-hours"
              config={sliders.researchHours}
              value={researchHours}
              onChange={setResearchHours}
              formatValue={(v) => `${v} t/uke`}
            />
            <RangeSlider
              id="hourly-rate"
              config={sliders.hourlyRate}
              value={hourlyRate}
              onChange={setHourlyRate}
              formatValue={(v) => `${v.toLocaleString("nb-NO")} kr/t`}
            />
            <RangeSlider
              id="leads-per-month"
              config={sliders.leadsPerMonth}
              value={leadsPerMonth}
              onChange={setLeadsPerMonth}
              formatValue={(v) => `${v} firma`}
            />
            <RangeSlider
              id="proff-subscription"
              config={sliders.proffSubscription}
              value={proffSubscription}
              onChange={setProffSubscription}
              formatValue={(v) => `${v.toLocaleString("nb-NO")} kr/mnd`}
            />
          </div>

          {/* Results */}
          <div className="space-y-5 lg:col-span-3">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Manual box */}
              <div className="rounded-2xl border border-brand-border bg-white p-6 shadow-card">
                <p className="type-label !text-slate-400">
                  {ROI_CALCULATOR.comparison.manual.title}
                </p>
                <p className="mt-1 font-sans text-xs text-slate-500">
                  {ROI_CALCULATOR.comparison.manual.subtitle}
                </p>
                <p className="mt-5 font-display text-3xl font-black tabular-nums text-brand-navy">
                  {formatHours(result.manualTotalHours)}
                </p>
                <p className="mt-1 font-sans text-xs text-slate-500">arbeid per måned</p>
                <ul className="mt-4 space-y-1.5 border-t border-brand-border pt-4 font-sans text-xs text-slate-600">
                  <li className="flex justify-between gap-2">
                    <span>Research (Proff/Google)</span>
                    <span className="tabular-nums">{formatHours(result.manualResearchHours)}</span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span>Per lead ({ROI_CALCULATOR.manualMinutesPerLead} min)</span>
                    <span className="tabular-nums">{formatHours(result.manualLeadHours)}</span>
                  </li>
                  {proffSubscription > 0 ? (
                    <li className="flex justify-between gap-2">
                      <span>Proff-abonnement</span>
                      <span className="tabular-nums">{formatNok(proffSubscription)}</span>
                    </li>
                  ) : null}
                </ul>
                <p className="mt-4 font-display text-xl font-bold tabular-nums text-slate-700">
                  {formatNok(result.manualTotalCost)}
                  <span className="ml-1 font-sans text-xs font-medium text-slate-400">
                    / mnd totalt
                  </span>
                </p>
              </div>

              {/* NyLead box */}
              <div className="rounded-2xl border border-brand-gold/30 bg-brand-goldPale/40 p-6 shadow-card ring-1 ring-brand-gold/15">
                <p className="type-label !text-brand-gold">
                  {ROI_CALCULATOR.comparison.nylead.title}
                </p>
                <p className="mt-1 font-sans text-xs text-slate-600">
                  {ROI_CALCULATOR.comparison.nylead.subtitle}
                </p>
                <p className="mt-5 font-display text-3xl font-black tabular-nums text-brand-navy">
                  {formatHours(result.nyleadTotalHours)}
                </p>
                <p className="mt-1 font-sans text-xs text-slate-500">arbeid per måned</p>
                <ul className="mt-4 space-y-1.5 border-t border-brand-gold/20 pt-4 font-sans text-xs text-slate-600">
                  <li className="flex justify-between gap-2">
                    <span>Oppsett og skann</span>
                    <span className="tabular-nums">{formatHours(result.nyleadResearchHours)}</span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span>Per lead ({ROI_CALCULATOR.nyleadMinutesPerLead} min)</span>
                    <span className="tabular-nums">{formatHours(result.nyleadLeadHours)}</span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span>NyLead-abonnement</span>
                    <span className="tabular-nums">{formatNok(planPrice)}</span>
                  </li>
                </ul>
                <p className="mt-4 font-display text-xl font-bold tabular-nums text-brand-navy">
                  {formatNok(result.nyleadTotalCost)}
                  <span className="ml-1 font-sans text-xs font-medium text-slate-400">
                    / mnd totalt
                  </span>
                </p>
              </div>
            </div>

            {/* Savings box */}
            <div
              className={cn(
                "rounded-2xl border p-6 sm:p-8",
                result.monthlySavings > 0
                  ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                  : "border-brand-border bg-brand-surface"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 font-sans text-sm font-semibold text-emerald-800">
                    <Coins className="h-4 w-4" />
                    Månedlig besparelse
                  </p>
                  <p
                    className={cn(
                      "mt-2 font-display text-4xl font-black tabular-nums sm:text-5xl",
                      result.monthlySavings > 0 ? "text-emerald-700" : "text-slate-500"
                    )}
                  >
                    {result.monthlySavings > 0
                      ? formatNok(result.monthlySavings)
                      : "Under break-even"}
                  </p>
                  {result.monthlySavings > 0 ? (
                    <p className="mt-2 font-sans text-sm text-emerald-700/80">
                      Du sparer ca. {formatHours(result.hoursSaved)} arbeidstid i måneden
                    </p>
                  ) : (
                    <p className="mt-2 font-sans text-sm text-slate-500">
                      Med disse tallene er manuell flyt billigere — prøv å øke leads eller
                      research-tid.
                    </p>
                  )}
                </div>

                {result.monthlySavings > 0 ? (
                  <div className="flex gap-6">
                    <div>
                      <p className="flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-wide text-emerald-700/70">
                        <TrendingUp className="h-3.5 w-3.5" />
                        ROI
                      </p>
                      <p className="mt-1 font-display text-2xl font-black tabular-nums text-emerald-700">
                        {Math.round(result.roiPercent)} %
                      </p>
                    </div>
                    {result.paybackDays !== null ? (
                      <div>
                        <p className="flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-wide text-emerald-700/70">
                          <Clock className="h-3.5 w-3.5" />
                          Tilbakebetaling
                        </p>
                        <p className="mt-1 font-display text-2xl font-black tabular-nums text-emerald-700">
                          {result.paybackDays} d
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {result.monthlySavings > 0 && result.paybackDays !== null ? (
                <p className="mt-4 font-sans text-sm text-emerald-800/75">
                  NyLead betaler seg på ca.{" "}
                  <strong>{result.paybackDays} dager</strong> med disse tallene.
                </p>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/registrer" className="btn-primary w-full sm:w-auto">
                  {ROI_CALCULATOR.cta.primary}
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </Link>
                <Link href="/app" className="btn-secondary w-full sm:w-auto">
                  {ROI_CALCULATOR.cta.secondary}
                </Link>
              </div>
            </div>

            {/* Formula explanation */}
            <details className="group rounded-xl border border-brand-border bg-brand-surface px-5 py-4 open:bg-white open:shadow-card">
              <summary className="cursor-pointer list-none font-sans text-sm font-semibold text-brand-navy marker:content-none sm:text-base [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-4">
                  {ROI_CALCULATOR.formula.title}
                  <span className="shrink-0 text-brand-gold transition group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <div className="mt-4 space-y-3 font-sans text-sm leading-relaxed text-slate-600">
                {ROI_CALCULATOR.formula.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>
            </details>
          </div>
        </div>
      </Container>
    </section>
  );
}
