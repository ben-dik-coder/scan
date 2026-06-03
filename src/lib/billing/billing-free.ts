/** E-poster som får full tilgang uten Stripe-abonnement (f.eks. plattform-eier). */
export function parseBillingFreeEmails(): Set<string> {
  const raw = process.env.BILLING_FREE_EMAILS?.trim() ?? "";
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isBillingFreeEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseBillingFreeEmails().has(email.trim().toLowerCase());
}
