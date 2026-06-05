import Stripe from "stripe";

let stripeClient: Stripe | null = null;

const WRAP_QUOTES = /^["'`\u201C\u201D\u2018\u2019]+|["'`\u201C\u201D\u2018\u2019]+$/g;
const STRIPE_SECRET_PATTERN = /^(sk|rk)_(live|test)_[A-Za-z0-9]+$/;
const STRIPE_SECRET_EMBEDDED = /((?:sk|rk)_(?:live|test)_[A-Za-z0-9]+)/;

/** Fjerner mellomrom, usynlige tegn og anførselstegn rundt nøkler fra Vercel */
export function normalizeSecret(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let v = value
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
    .trim();

  // Fjern anførselstegn (vanlige og «smarte») rundt verdien — også når bare én side har quote
  for (let i = 0; i < 3; i++) {
    const next = v.replace(WRAP_QUOTES, "").trim();
    if (next === v) break;
    v = next;
  }

  // Noen limer inn hele linjen: STRIPE_SECRET_KEY=sk_live_...
  const envLine = v.match(/^STRIPE_[A-Z0-9_]+\s*=\s*(.+)$/i);
  if (envLine) {
    v = envLine[1].replace(WRAP_QUOTES, "").trim();
  }

  // Finn sk_/rk_-nøkkel inni tekst (f.eks. notater eller ekstra tegn)
  if (!STRIPE_SECRET_PATTERN.test(v)) {
    const embedded = v.match(STRIPE_SECRET_EMBEDDED);
    if (embedded) v = embedded[1];
  }

  return v || undefined;
}

export function getStripeSecretKey(): string | undefined {
  return normalizeSecret(process.env.STRIPE_SECRET_KEY);
}

export function getStripeWebhookSecret(): string | undefined {
  return normalizeSecret(process.env.STRIPE_WEBHOOK_SECRET);
}

export function isValidStripeSecretKey(key?: string): boolean {
  const value = key ?? getStripeSecretKey();
  if (!value || value.startsWith("pk_")) return false;
  return STRIPE_SECRET_PATTERN.test(value);
}

export type StripeKeyKind =
  | "live"
  | "test"
  | "publishable-feil"
  | "webhook-feil"
  | "price-feil"
  | "product-feil"
  | "ukjent-format"
  | "mangler";

export function getStripeKeyKind(key?: string): StripeKeyKind {
  const value = key ?? getStripeSecretKey();
  if (!value) return "mangler";
  if (value.startsWith("whsec_")) return "webhook-feil";
  if (value.startsWith("price_")) return "price-feil";
  if (value.startsWith("prod_")) return "product-feil";
  if (value.startsWith("pk_")) return "publishable-feil";
  if (value.startsWith("sk_live_") || value.startsWith("rk_live_")) return "live";
  if (value.startsWith("sk_test_") || value.startsWith("rk_test_")) return "test";
  return "ukjent-format";
}

function maskStripeKeyPrefix(value: string): string {
  if (value.length <= 10) return `${value.slice(0, 3)}… (lengde ${value.length})`;
  return `${value.slice(0, 10)}… (lengde ${value.length})`;
}

export function stripeSecretKeyDebugInfo(): {
  rawLength: number;
  normalizedLength: number;
  kind: StripeKeyKind;
  maskedPrefix: string | null;
  issues: string[];
} {
  const raw = process.env.STRIPE_SECRET_KEY ?? "";
  const normalized = getStripeSecretKey();
  const issues: string[] = [];

  if (!raw) issues.push("mangler");
  if (raw && raw !== raw.trim()) issues.push("mellomrom-i-start-slutt");
  if (/[\r\n]/.test(raw)) issues.push("linjeskift");
  if (/["'`\u201C\u201D\u2018\u2019]/.test(raw)) issues.push("anførselstegn");
  if (/[\u200B-\u200D\uFEFF]/.test(raw)) issues.push("usynlige-tegn");
  if (/^STRIPE_/i.test(raw.trim())) issues.push("env-linje");

  return {
    rawLength: raw.length,
    normalizedLength: normalized?.length ?? 0,
    kind: getStripeKeyKind(normalized),
    maskedPrefix: normalized ? maskStripeKeyPrefix(normalized) : null,
    issues,
  };
}

function stripeKeyDiagnostics(raw?: string, normalized?: string): string {
  const rawValue = raw ?? process.env.STRIPE_SECRET_KEY ?? "";
  const clean = normalized ?? normalizeSecret(rawValue);
  const parts: string[] = [];

  if (!rawValue) {
    parts.push("variabelen er tom");
  } else {
    if (rawValue !== rawValue.trim()) parts.push("har mellomrom i start/slutt");
    if (/[\r\n]/.test(rawValue)) parts.push("inneholder linjeskift");
    if (/["'`\u201C\u201D\u2018\u2019]/.test(rawValue)) parts.push("inneholder anførselstegn");
    if (/[\u200B-\u200D\uFEFF]/.test(rawValue)) parts.push("inneholder usynlige tegn");
    if (/^STRIPE_/i.test(rawValue.trim())) parts.push("ser ut som env-linje (STRIPE_…=)");
    if (clean) parts.push(`starter med ${maskStripeKeyPrefix(clean)}`);
    else parts.push("blir tom etter opprydding");
  }

  return parts.join(", ");
}

export function stripeSecretKeyError(): string | null {
  const raw = process.env.STRIPE_SECRET_KEY;
  const value = getStripeSecretKey();
  const kind = getStripeKeyKind(value);
  const diag = stripeKeyDiagnostics(raw, value);

  switch (kind) {
    case "mangler":
      return `STRIPE_SECRET_KEY mangler i Vercel (${diag}). Sjekk at den er satt for Production, ikke bare Preview.`;
    case "publishable-feil":
      return `STRIPE_SECRET_KEY er publishable key (pk_…). Bruk Secret key (sk_live_… eller sk_test_…). Fant: ${maskStripeKeyPrefix(value!)}.`;
    case "webhook-feil":
      return "STRIPE_SECRET_KEY inneholder webhook secret (whsec_…). Lim inn Secret key i STRIPE_SECRET_KEY og webhook secret i STRIPE_WEBHOOK_SECRET.";
    case "price-feil":
      return "STRIPE_SECRET_KEY inneholder Price ID (price_…). Lim Price ID inn i STRIPE_PRICE i stedet.";
    case "product-feil":
      return "STRIPE_SECRET_KEY inneholder Product ID (prod_…). Bruk Price ID (price_…) i STRIPE_PRICE.";
    case "ukjent-format":
      return `STRIPE_SECRET_KEY ser ugyldig ut (${diag}). Den skal starte med sk_live_ (prod) eller sk_test_ (test), uten anførselstegn.`;
    default:
      return null;
  }
}

export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  const configError = stripeSecretKeyError();
  if (configError) {
    throw new Error(configError);
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key!);
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return isValidStripeSecretKey();
}

/** Ekte Stripe Checkout krever gyldig nøkkel + pris-ID for NyLead */
export function isStripeFullyConfigured(): boolean {
  return Boolean(
    isValidStripeSecretKey() &&
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
