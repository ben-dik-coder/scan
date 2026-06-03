import type { ComponentType } from "react";

export type ThemePreviewPair = {
  LandingPreview: ComponentType;
  ScanPreview: ComponentType;
};

export const THEME_IDS = [
  "apollo-obsidian",
  "linear-precision",
  "stripe-clarity",
  "spreadsheet-pro",
  "notion-warm",
  "glass-command",
  "cognism-trust",
  "zoominfo-density",
  "nylead-nordic",
  "hubspot-energy",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export async function loadThemePreviews(id: string): Promise<ThemePreviewPair | null> {
  switch (id) {
    case "apollo-obsidian":
      return {
        LandingPreview: (await import("./themes/01-apollo-obsidian/landing/LandingPreview")).LandingPreview,
        ScanPreview: (await import("./themes/01-apollo-obsidian/scan/ScanPreview")).ScanPreview,
      };
    case "linear-precision":
      return {
        LandingPreview: (await import("./themes/02-linear-precision/landing/LandingPreview")).LandingPreview,
        ScanPreview: (await import("./themes/02-linear-precision/scan/ScanPreview")).ScanPreview,
      };
    case "stripe-clarity":
      return {
        LandingPreview: (await import("./themes/03-stripe-clarity/landing/LandingPreview")).LandingPreview,
        ScanPreview: (await import("./themes/03-stripe-clarity/scan/ScanPreview")).ScanPreview,
      };
    case "spreadsheet-pro":
      return {
        LandingPreview: (await import("./themes/04-spreadsheet-pro/landing/LandingPreview")).LandingPreview,
        ScanPreview: (await import("./themes/04-spreadsheet-pro/scan/ScanPreview")).ScanPreview,
      };
    case "notion-warm":
      return {
        LandingPreview: (await import("./themes/05-notion-warm/landing/LandingPreview")).LandingPreview,
        ScanPreview: (await import("./themes/05-notion-warm/scan/ScanPreview")).ScanPreview,
      };
    case "glass-command":
      return {
        LandingPreview: (await import("./themes/06-glass-command/landing/LandingPreview")).LandingPreview,
        ScanPreview: (await import("./themes/06-glass-command/scan/ScanPreview")).ScanPreview,
      };
    case "cognism-trust":
      return {
        LandingPreview: (await import("./themes/07-cognism-trust/landing/LandingPreview")).LandingPreview,
        ScanPreview: (await import("./themes/07-cognism-trust/scan/ScanPreview")).ScanPreview,
      };
    case "zoominfo-density":
      return {
        LandingPreview: (await import("./themes/08-zoominfo-density/landing/LandingPreview")).LandingPreview,
        ScanPreview: (await import("./themes/08-zoominfo-density/scan/ScanPreview")).ScanPreview,
      };
    case "nylead-nordic":
      return {
        LandingPreview: (await import("./themes/09-nylead-nordic/landing/LandingPreview")).LandingPreview,
        ScanPreview: (await import("./themes/09-nylead-nordic/scan/ScanPreview")).ScanPreview,
      };
    case "hubspot-energy":
      return {
        LandingPreview: (await import("./themes/10-hubspot-energy/landing/LandingPreview")).LandingPreview,
        ScanPreview: (await import("./themes/10-hubspot-energy/scan/ScanPreview")).ScanPreview,
      };
    default:
      return null;
  }
}
