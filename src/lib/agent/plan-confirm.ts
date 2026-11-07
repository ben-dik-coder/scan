export type PlanConfirmKind = "scan_or_save" | "save_only" | "delete_confirm";

export type PlanConfirmState = {
  kind: PlanConfirmKind;
  confirmToken?: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
};

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

  if (/er du sikker|bekreft(?:e)? sletting|bekreft at du vil slette/i.test(text)) {
    return "delete_confirm";
  }

  return null;
}

export function planConfirmActions(
  state: PlanConfirmState | PlanConfirmKind
): PlanConfirmAction[] {
  const value: PlanConfirmState =
    typeof state === "string" ? { kind: state } : state;
  if (value.kind === "scan_or_save") return SCAN_OR_SAVE_ACTIONS;
  if (value.kind === "save_only") return SAVE_ONLY_ACTIONS;

  const resourceType = value.resourceType ?? "ressurs";
  const resourceId = value.resourceId ?? "";
  const confirmToken = value.confirmToken ?? "";
  return [
    {
      label: "Ja, jeg er sikker — slett",
      message: `Bekreft sletting: ${resourceType} ${resourceId} token=${confirmToken}`,
      variant: "primary",
    },
    {
      label: "Avbryt",
      message: "Avbryt slettingen",
      variant: "secondary",
    },
  ];
}
