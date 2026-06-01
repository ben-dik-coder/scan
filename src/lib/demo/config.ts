export const isDemoMode = () =>
  process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** Hent firma direkte fra Brønnøysund API (standard: på) */
export const isBrregLive = () =>
  process.env.NEXT_PUBLIC_BRREG_LIVE !== "false";

export const DEMO_USER = {
  id: "demo-user",
  email: "demo@nylead.no",
  company_name: "Demo Bedrift AS",
  role: "admin" as const,
};
