import type { Company } from "@/types/database";

export function computeLeadScore(company: Company): number {
  let score = 0;

  if (company.has_email) score += 30;
  if (company.email_is_generic) score += 20;
  if (company.phone || company.mobile) score += 15;

  if (company.registered_at) {
    const registered = new Date(company.registered_at);
    const daysSince =
      (Date.now() - registered.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 7) score += 25;
    else if (daysSince <= 30) score += 15;
    else if (daysSince <= 90) score += 5;
  }

  return Math.min(100, score);
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Høy";
  if (score >= 50) return "Medium";
  return "Lav";
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-white/50";
}
