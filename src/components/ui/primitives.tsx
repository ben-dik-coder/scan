import { cn } from "@/lib/utils";

export function ScoreRing({
  score,
  size = "md",
  light = false,
  title,
}: {
  /** 0–100, eller null hvis ikke skannet */
  score: number | null;
  size?: "sm" | "md";
  light?: boolean;
  title?: string;
}) {
  const r = size === "sm" ? 16 : 20;
  const stroke = size === "sm" ? 3 : 4;
  const dim = (r + stroke) * 2;
  const circ = 2 * Math.PI * r;
  const value = score ?? 0;
  const offset = circ - (value / 100) * circ;
  const color =
    score === null
      ? light
        ? "#cbd5e1"
        : "rgba(255,255,255,0.15)"
      : score >= 80
        ? "#c9a227"
        : score >= 50
          ? "#e5c04a"
          : score === 0
            ? light
              ? "#94a3b8"
              : "#64748b"
            : light
              ? "#64748b"
              : "#94a3b8";

  const trackStroke = light ? "rgba(148,163,184,0.35)" : "rgba(255,255,255,0.1)";

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        size === "sm" ? "h-9 w-9" : "h-11 w-11"
      )}
      title={title}
    >
      <svg width={dim} height={dim} className="-rotate-90">
        <circle
          cx={r + stroke}
          cy={r + stroke}
          r={r}
          fill="none"
          stroke={trackStroke}
          strokeWidth={stroke}
        />
        {score !== null && (
          <circle
            cx={r + stroke}
            cy={r + stroke}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        )}
      </svg>
      <span
        className={cn(
          "absolute font-display font-bold",
          size === "sm" ? "text-[10px]" : "text-xs",
          score === null
            ? light
              ? "text-slate-300"
              : "text-white/25"
            : score >= 80
              ? "text-brand-gold"
              : score >= 50
                ? "text-brand-goldLight"
                : light
                  ? "text-slate-400"
                  : "text-white/40"
        )}
      >
        {score === null ? "—" : score}
      </span>
    </div>
  );
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  const colors: Record<string, string> = {
    ny: "bg-white/10 text-white/70 border-white/15",
    kontaktet: "bg-blue-500/15 text-blue-300 border-blue-500/25",
    svarte: "bg-brand-gold/15 text-brand-gold border-brand-gold/25",
    moete_booket: "bg-violet-500/15 text-violet-300 border-violet-500/25",
    vunnet: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    tapt: "bg-red-500/15 text-red-300 border-red-500/25",
    ikke_interessert: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        colors[status] ?? colors.ny
      )}
    >
      {label}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="min-w-0 flex-1">
        <h1 className="page-header-title">{title}</h1>
        {description && (
          <p className="mt-1.5 font-sans text-xs font-medium text-white/50 sm:mt-2 sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  highlight,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        "surface-panel-dark relative overflow-hidden p-5",
        highlight && "border-brand-gold/30 bg-brand-gold/5"
      )}
    >
      <div className="flex items-start justify-between">
        <p className="font-display text-[10px] font-bold uppercase tracking-athletic text-white/40">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-white/40" />}
      </div>
      <p className="mt-3 font-display text-4xl font-black leading-none text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-white/50">{sub}</p>}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
        <span className="text-2xl opacity-40">∅</span>
      </div>
      <p className="font-display font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-white/50">{description}</p>
    </div>
  );
}
