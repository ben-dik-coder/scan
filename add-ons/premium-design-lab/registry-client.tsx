"use client";

import type { ComponentType } from "react";
import { LandingPreview as ApolloLanding } from "./themes/01-apollo-obsidian/landing/LandingPreview";
import { ScanPreview as ApolloScan } from "./themes/01-apollo-obsidian/scan/ScanPreview";
import { LandingPreview as LinearLanding } from "./themes/02-linear-precision/landing/LandingPreview";
import { ScanPreview as LinearScan } from "./themes/02-linear-precision/scan/ScanPreview";
import { LandingPreview as StripeLanding } from "./themes/03-stripe-clarity/landing/LandingPreview";
import { ScanPreview as StripeScan } from "./themes/03-stripe-clarity/scan/ScanPreview";
import { LandingPreview as SpreadsheetLanding } from "./themes/04-spreadsheet-pro/landing/LandingPreview";
import { ScanPreview as SpreadsheetScan } from "./themes/04-spreadsheet-pro/scan/ScanPreview";
import { LandingPreview as NotionLanding } from "./themes/05-notion-warm/landing/LandingPreview";
import { ScanPreview as NotionScan } from "./themes/05-notion-warm/scan/ScanPreview";
import { LandingPreview as GlassLanding } from "./themes/06-glass-command/landing/LandingPreview";
import { ScanPreview as GlassScan } from "./themes/06-glass-command/scan/ScanPreview";
import { LandingPreview as CognismLanding } from "./themes/07-cognism-trust/landing/LandingPreview";
import { ScanPreview as CognismScan } from "./themes/07-cognism-trust/scan/ScanPreview";
import { LandingPreview as ZoomLanding } from "./themes/08-zoominfo-density/landing/LandingPreview";
import { ScanPreview as ZoomScan } from "./themes/08-zoominfo-density/scan/ScanPreview";
import { LandingPreview as NordicLanding } from "./themes/09-nylead-nordic/landing/LandingPreview";
import { ScanPreview as NordicScan } from "./themes/09-nylead-nordic/scan/ScanPreview";
import { LandingPreview as HubspotLanding } from "./themes/10-hubspot-energy/landing/LandingPreview";
import { ScanPreview as HubspotScan } from "./themes/10-hubspot-energy/scan/ScanPreview";

export type ThemePreviewPair = {
  LandingPreview: ComponentType;
  ScanPreview: ComponentType;
};

const PREVIEWS: Record<string, ThemePreviewPair> = {
  "apollo-obsidian": { LandingPreview: ApolloLanding, ScanPreview: ApolloScan },
  "linear-precision": { LandingPreview: LinearLanding, ScanPreview: LinearScan },
  "stripe-clarity": { LandingPreview: StripeLanding, ScanPreview: StripeScan },
  "spreadsheet-pro": { LandingPreview: SpreadsheetLanding, ScanPreview: SpreadsheetScan },
  "notion-warm": { LandingPreview: NotionLanding, ScanPreview: NotionScan },
  "glass-command": { LandingPreview: GlassLanding, ScanPreview: GlassScan },
  "cognism-trust": { LandingPreview: CognismLanding, ScanPreview: CognismScan },
  "zoominfo-density": { LandingPreview: ZoomLanding, ScanPreview: ZoomScan },
  "nylead-nordic": { LandingPreview: NordicLanding, ScanPreview: NordicScan },
  "hubspot-energy": { LandingPreview: HubspotLanding, ScanPreview: HubspotScan },
};

export function getThemePreviews(id: string): ThemePreviewPair | null {
  return PREVIEWS[id] ?? null;
}
