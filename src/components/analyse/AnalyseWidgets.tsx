import { cn } from "@/lib/utils";
import type {
  AnalyseKpi,
  AnalyseNamedCount,
  AnalyseDayPoint,
} from "@/lib/analyse/types";
import { formatPct } from "@/lib/analyse/metrics";

export function AnalyseKpiGrid({ items }: { items: AnalyseKpi[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((kpi) => (
        <div
          key={kpi.id}
          className={cn(
            "rounded-2xl border px-4 py-3.5",
            kpi.tone === "good" && "border-emerald-500/30 bg-emerald-500/[0.07]",
            kpi.tone === "warn" && "border-amber-500/30 bg-amber-500/[0.07]",
            kpi.tone === "bad" && "border-rose-500/30 bg-rose-500/[0.07]",
            (!kpi.tone || kpi.tone === "default") &&
              "border-white/[0.1] bg-white/[0.03]"
          )}
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {kpi.label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-white">
            {kpi.value}
          </p>
          {kpi.sub ? <p className="mt-1 text-xs text-zinc-500">{kpi.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function AnalysePanel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/[0.1] bg-white/[0.03]",
        className
      )}
    >
      <div className="border-b border-white/[0.08] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function AnalyseBarList({
  items,
  empty = "Ingen tall ennå",
}: {
  items: AnalyseNamedCount[];
  empty?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.every((i) => i.count === 0)) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const width = Math.max(4, Math.round((item.count / max) * 100));
        return (
          <li key={item.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-zinc-300">{item.label}</span>
              <span className="shrink-0 tabular-nums text-zinc-400">
                {item.count}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500/80 to-emerald-400/80"
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AnalyseFunnel({
  steps,
}: {
  steps: Array<{ label: string; value: number | null }>;
}) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-zinc-400">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-300">{step.label}</p>
          </div>
          <p className="text-lg font-semibold tabular-nums text-white">
            {formatPct(step.value)}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function AnalyseSparkBars({
  points,
  empty = "Ingen data i perioden",
}: {
  points: AnalyseDayPoint[];
  empty?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const total = points.reduce((s, p) => s + p.count, 0);
  if (total === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }
  return (
    <div>
      <div className="flex h-28 items-end gap-1.5">
        {points.map((p) => {
          const h = Math.max(6, Math.round((p.count / max) * 100));
          return (
            <div
              key={p.date}
              className="group relative flex min-w-0 flex-1 flex-col items-center justify-end"
              title={`${p.label}: ${p.count}`}
            >
              <div
                className="w-full rounded-t-md bg-sky-400/70 transition group-hover:bg-emerald-400/80"
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function AnalyseHealthCard({
  score,
  label,
  hints,
}: {
  score: number;
  label: string;
  hints: string[];
}) {
  const tone =
    score >= 75 ? "good" : score >= 50 ? "warn" : ("bad" as const);
  return (
    <AnalysePanel
      title="Salgshelse"
      subtitle="Enkel score basert på tempo, pipeline og ring"
    >
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p
            className={cn(
              "text-5xl font-semibold tabular-nums tracking-tight",
              tone === "good" && "text-emerald-300",
              tone === "warn" && "text-amber-300",
              tone === "bad" && "text-rose-300"
            )}
          >
            {score}
          </p>
          <p className="mt-1 text-sm text-zinc-400">{label}</p>
        </div>
        <ul className="min-w-[16rem] flex-1 space-y-2 text-sm text-zinc-400">
          {hints.map((hint) => (
            <li
              key={hint}
              className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
            >
              {hint}
            </li>
          ))}
        </ul>
      </div>
    </AnalysePanel>
  );
}

export function AnalyseMeter({
  label,
  used,
  limit,
  unit = "",
}: {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}) {
  const pctVal = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className="tabular-nums text-zinc-400">
          {used}
          {unit} / {limit}
          {unit}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pctVal >= 90
              ? "bg-rose-400"
              : pctVal >= 70
                ? "bg-amber-400"
                : "bg-emerald-400"
          )}
          style={{ width: `${pctVal}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-zinc-500">{pctVal}% brukt</p>
    </div>
  );
}
