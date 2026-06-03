import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/** Fjerner mellomrom og anførselstegn rundt nøkler fra Vercel */
function normalizeSecret(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v || undefined;
}

export function getStripeSecretKey(): string | undefined {
  return normalizeSecret(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY er ikke satt");
  }
  if (key.startsWith("pk_")) {
    throw new Error(
      "STRIPE_SECRET_KEY er feil type (publishable pk_…). Bruk Secret key som starter med sk_live_ eller sk_test_."
    );
  }
  if (!/^sk_(live|test)_/.test(key) && !/^rk_(live|test)_/.test(key)) {
    throw new Error(
      "STRIPE_SECRET_KEY ser ugyldig ut. Den skal starte med sk_live_ (prod) eller sk_test_ (test)."
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(getStripeSecretKey());
}

/** Ekte Stripe Checkout krever nøkkel + pris-ID for NyLead */
export function isStripeFullyConfigured(): boolean {
  return Boolean(
    getStripeSecretKey() &&
      (normalizeSecret(process.env.STRIPE_PRICE) ||
        normalizeSecret(process.env.STRIPE_PRICE_NYLEAD) ||
        normalizeSecret(process.env.STRIPE_PRICE_START))
  );
}

export function appUrl(): string {
  let raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3003");

  raw = raw.replace(/\/$/, "");

  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw.replace(/^\/+/, "")}`;
  }

  try {
    return new URL(raw).origin;
  } catch {
    return "https://nylead.no";
  }
}
