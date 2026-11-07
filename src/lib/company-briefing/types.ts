export type BriefingItemStatus = "missing" | "ok" | "unknown" | "tip";

export type CompanyBriefingItem = {
  id: string;
  label: string;
  status: BriefingItemStatus;
  /** Kort forklaring — hvorfor det betyr noe */
  why: string;
};

export type CompanyBriefing = {
  verticalId: string;
  verticalLabel: string;
  /** Én linje: hva de holder på med */
  headline: string;
  /** 1–2 setninger, menneskelig */
  summary: string;
  /** Brreg-næringskode + tekst hvis vi har den */
  naceCode: string | null;
  naceLabel: string | null;
  checklist: CompanyBriefingItem[];
};
