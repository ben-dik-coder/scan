export type WebsiteScanSource =
  | "google_cse"
  | "serpapi"
  | "both"
  | "demo"
  | "email_domain"
  | "none";

export type WebsiteScanStatus = "idle" | "scanning" | "done" | "error";

export type WebsiteKind = "own" | "booking_only" | "none";

export type WebsiteScanResult = {
  orgnr: string;
  hasWebsite: boolean;
  /** own = egen nettside, booking_only = kun Timma/Fixit osv., none = ingen treff */
  websiteKind: WebsiteKind;
  websiteUrl: string | null;
  websiteDomain: string | null;
  bookingPlatform: string | null;
  source: WebsiteScanSource;
  confidence: "high" | "medium" | "low";
  query: string;
  scannedAt: string;
  error?: string;
  /** Rå treff for debugging / visning */
  topHits?: Array<{ title: string; link: string; domain: string }>;
};

export type WebsiteScanCompanyInput = {
  orgnr: string;
  name: string;
  email?: string | null;
  municipality_name?: string | null;
};
