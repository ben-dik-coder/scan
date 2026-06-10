export type PlanConfirmKind = "scan_or_save" | "save_only";

export type PlanConfirmAction = {
  label: string;
  message: string;
  variant: "primary" | "secondary";
};

const SCAN_OR_SAVE_ACTIONS: PlanConfirmAction[] = [
  {
    label: "Skann nettside",
    message: "Skann nettside på disse",
    variant: "primary",
  },
  {
    label: "Lagre liste",
    message: "Lagre som liste",
    variant: "secondary",
  },
];

const SAVE_ONLY_ACTIONS: PlanConfirmAction[] = [
  {
    label: "Lagre liste",
    message: "Ja, lagre listen",
    variant: "primary",
  },
  {
    label: "Ikke ennå",
    message: "Nei, ikke lagre ennå — skann flere",
    variant: "secondary",
  },
];

export function detectPlanConfirmKind(content: string): PlanConfirmKind | null {
  const text = content.trim();
  if (!text) return null;

  if (/vil du skanne nettside eller lagre som liste/i.test(text)) {
    return "scan_or_save";
  }

  if (/si fra om du vil skanne nettside eller lagre som liste/i.test(text)) {
    return "scan_or_save";
  }

  if (/vil du lagre som liste/i.test(text)) {
    return "save_only";
  }

  return null;
}

export function planConfirmActions(kind: PlanConfirmKind): PlanConfirmAction[] {
  return kind === "scan_or_save" ? SCAN_OR_SAVE_ACTIONS : SAVE_ONLY_ACTIONS;
}
