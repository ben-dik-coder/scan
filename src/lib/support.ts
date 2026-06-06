export const support = {
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "bendikdigitalnorge@outlook.com",
  emailResponseLabel: "Svar innen 24 timer",
  phone: "94155019",
  phoneE164: "+4794155019",
  phoneDisplay: "+47 941 55 019",
  phoneHoursLabel: "Åpent 24/7",
  topics: [
    "Konto og innlogging",
    "E-postkobling",
    "Skann og leads",
    "Abonnement og faktura",
  ],
} as const;
