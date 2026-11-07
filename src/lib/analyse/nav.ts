import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  GitBranch,
  LineChart,
  Mail,
  MessageSquare,
  PhoneCall,
  Radar,
  Wallet,
} from "lucide-react";

export type AnalyseNavItem = {
  href: string;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
};

/** Undermenyer under Analyse — speiler faktiske salgsflater i NyLead. */
export const ANALYSE_NAV: AnalyseNavItem[] = [
  {
    href: "/app/analyse",
    label: "Oversikt",
    short: "KPI",
    description: "Helhetsbilde: helse, tempo og hva som trekker ned.",
    icon: LineChart,
  },
  {
    href: "/app/analyse/pipeline",
    label: "Pipeline",
    short: "Funnel",
    description: "Statusfordeling, konvertering og flaskehalser.",
    icon: GitBranch,
  },
  {
    href: "/app/analyse/ring",
    label: "Ring & AI",
    short: "Ring",
    description: "Utfall, svarrate og AI-samtaler over tid.",
    icon: PhoneCall,
  },
  {
    href: "/app/analyse/sms",
    label: "SMS",
    short: "SMS",
    description: "Volum og kontakt via SMS i aktivitetsloggen.",
    icon: MessageSquare,
  },
  {
    href: "/app/analyse/kampanjer",
    label: "E-post & sekvenser",
    short: "E-post",
    description: "Sendt, feilet, aktive sekvenser og svar.",
    icon: Mail,
  },
  {
    href: "/app/analyse/prospektering",
    label: "Prospektering",
    short: "Scan",
    description: "Kødekning, oppfølginger og lead-tempo.",
    icon: Radar,
  },
  {
    href: "/app/analyse/aktivitet",
    label: "Aktivitet",
    short: "Logg",
    description: "Daglig aktivitet og hvilke handlinger som dominerer.",
    icon: Activity,
  },
  {
    href: "/app/analyse/kostnader",
    label: "Kostnader & forbruk",
    short: "Kost",
    description: "Serper-kvote, AI-ring volum og kapasitet.",
    icon: Wallet,
  },
];

export const ANALYSE_ROOT_ICON = BarChart3;

export function isAnalysePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/app/analyse" || pathname.startsWith("/app/analyse/");
}

export function analyseNavItem(pathname: string): AnalyseNavItem {
  const exact = ANALYSE_NAV.find((item) => item.href === pathname);
  if (exact) return exact;
  return ANALYSE_NAV[0]!;
}
