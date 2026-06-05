import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRegisteredDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Relativ tid på norsk, f.eks. «for 2 d siden» */
export function formatRelativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "nå";
  if (diffMin < 60) return `for ${diffMin} min siden`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `for ${diffHours} t siden`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `for ${diffDays} d siden`;
  return formatRegisteredDate(iso);
}

/** Er oppfølgingsdato passert? */
export function isFollowUpOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

/** Lesbar oppfølgingsdato */
export function formatFollowUpLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffDays = Math.ceil((then - Date.now()) / 86_400_000);
  if (diffDays < 0) return `${Math.abs(diffDays)} d forsinket`;
  if (diffDays === 0) return "i dag";
  if (diffDays === 1) return "i morgen";
  return `om ${diffDays} d`;
}
