/** Oppdater med ditt registrerte firma — vises i personvern og vilkår */
export const legal = {
  productName: "NyLead",
  operatorName: process.env.NEXT_PUBLIC_LEGAL_NAME ?? "NyLead",
  orgNr: process.env.NEXT_PUBLIC_LEGAL_ORG_NR ?? "",
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS ?? "Norge",
  contactEmail: process.env.NEXT_PUBLIC_LEGAL_EMAIL ?? "post@nylead.no",
  lastUpdated: "1. juni 2026",
} as const;
