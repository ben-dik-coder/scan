export type PremiumThemeMeta = {
  id: string;
  folder: string;
  nameNo: string;
  landingVibe: string;
  scanVibe: string;
  inspiration: string;
};

export const PREMIUM_THEMES: PremiumThemeMeta[] = [
  {
    id: "apollo-obsidian",
    folder: "01-apollo-obsidian",
    nameNo: "Apollo Obsidian",
    landingVibe: "Mørk premium, lilla/blå accent",
    scanVibe: "Kommandosenter, gull CTA",
    inspiration: "Apollo.io",
  },
  {
    id: "linear-precision",
    folder: "02-linear-precision",
    nameNo: "Linear Precision",
    landingVibe: "Hvit, 1px grid, monospace",
    scanVibe: "Ultra-ren filterrad",
    inspiration: "Linear",
  },
  {
    id: "stripe-clarity",
    folder: "03-stripe-clarity",
    nameNo: "Stripe Clarity",
    landingVibe: "Myk gradient, tydelig hierarki",
    scanVibe: "Kort rundt filter og liste",
    inspiration: "Stripe",
  },
  {
    id: "spreadsheet-pro",
    folder: "04-spreadsheet-pro",
    nameNo: "Spreadsheet Pro",
    landingVibe: "Enterprise, data-tunge stats",
    scanVibe: "Apollo-stil spreadsheet-grid",
    inspiration: "Apollo CRM grid",
  },
  {
    id: "notion-warm",
    folder: "05-notion-warm",
    nameNo: "Notion Warm",
    landingVibe: "Vennlig, rund, menneskelig",
    scanVibe: "Myke paneler, rolig liste",
    inspiration: "Notion",
  },
  {
    id: "glass-command",
    folder: "06-glass-command",
    nameNo: "Glass Command",
    landingVibe: "Glassmorphism, blur, dybde",
    scanVibe: "Flytende filter-bar",
    inspiration: "2026 SaaS glass",
  },
  {
    id: "cognism-trust",
    folder: "07-cognism-trust",
    nameNo: "Cognism Trust",
    landingVibe: "EU B2B, compliance-følelse",
    scanVibe: "Seriøs tabell, tydelige badges",
    inspiration: "Cognism",
  },
  {
    id: "zoominfo-density",
    folder: "08-zoominfo-density",
    nameNo: "ZoomInfo Density",
    landingVibe: "Power platform, proof points",
    scanVibe: "Sidebar-filtre, maks data",
    inspiration: "ZoomInfo",
  },
  {
    id: "nylead-nordic",
    folder: "09-nylead-nordic",
    nameNo: "NyLead Nordic",
    landingVibe: "Forfinet navy + grønn",
    scanVibe: "Premium versjon av dagens UI",
    inspiration: "NyLead brand",
  },
  {
    id: "hubspot-energy",
    folder: "10-hubspot-energy",
    nameNo: "HubSpot Energy",
    landingVibe: "Varm coral CTA, energisk",
    scanVibe: "Oransje på handlinger",
    inspiration: "HubSpot",
  },
];

export function getThemeById(id: string): PremiumThemeMeta | undefined {
  return PREMIUM_THEMES.find((t) => t.id === id);
}
