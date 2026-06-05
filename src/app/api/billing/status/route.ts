import { NextResponse } from "next/server";
import { isFakeBillingEnabled } from "@/lib/billing/fake-billing";
import { NYLEAD_PLAN } from "@/lib/billing/plans";
import {
  appUrl,
  getStripeKeyKind,
  getStripeWebhookSecret,
  isStripeConfigured,
  isStripeFullyConfigured,
  type StripeKeyKind,
} from "@/lib/billing/stripe";

function publicStripeKeyHint(kind: StripeKeyKind): string | null {
  switch (kind) {
    case "mangler":
      return "STRIPE_SECRET_KEY mangler i Vercel (Production). Redeploy etter lagring.";
    case "publishable-feil":
      return "STRIPE_SECRET_KEY er publishable key (pk_…). Bruk Secret key (sk_live_… eller sk_test_…).";
    case "webhook-feil":
      return "STRIPE_SECRET_KEY inneholder webhook secret (whsec_…). Flytt den til STRIPE_WEBHOOK_SECRET.";
    case "price-feil":
      return "STRIPE_SECRET_KEY inneholder Price ID (price_…). Lim Price ID inn i STRIPE_PRICE i stedet.";
    case "product-feil":
      return "STRIPE_SECRET_KEY inneholder Product ID (prod_…). Bruk Price ID (price_…) i STRIPE_PRICE.";
    case "ukjent-format":
      return "STRIPE_SECRET_KEY ser ugyldig ut. Den skal starte med sk_live_ (prod) eller sk_test_ (test), uten anførselstegn.";
    default:
      return null;
  }
}

export async function GET() {
  const fakeBilling = isFakeBillingEnabled();
  const stripeReady = isStripeFullyConfigured();
  const keyKind = getStripeKeyKind();
  const webhookSecret = getStripeWebhookSecret();
  const webhookSet = Boolean(webhookSecret?.startsWith("whsec_"));
  const keyHint = publicStripeKeyHint(keyKind);
  const canonicalAppUrl =
    process.env.VERCEL_ENV === "production" ? "https://nylead.no" : appUrl();
  const appUrlMismatch =
    process.env.VERCEL_ENV === "production" &&
    appUrl() !== canonicalAppUrl;

  let hint: string;
  if (keyHint) {
    hint = keyHint;
  } else if (fakeBilling) {
    hint = "Test-modus: sett BILLING_FAKE=false i Vercel når Stripe er riktig satt opp.";
  } else if (!stripeReady) {
    hint = "Mangler gyldig STRIPE_SECRET_KEY eller STRIPE_PRICE i Vercel.";
  } else if (!webhookSet) {
    hint =
      "Stripe Checkout er klar, men STRIPE_WEBHOOK_SECRET mangler. Betaling kan aktiveres via confirm-session, men abonnementsendringer krever webhook.";
  } else if (appUrlMismatch) {
    hint = `Sett NEXT_PUBLIC_APP_URL=${canonicalAppUrl} i Vercel (nå ${appUrl()}). Webhook bør peke til ${canonicalAppUrl}/api/billing/webhook.`;
  } else {
    hint = `Stripe Checkout er aktiv. Webhook: ${appUrl()}/api/billing/webhook`;
  }

  return NextResponse.json({
    fakeBilling,
    stripeReady,
    stripeKeySet: isStripeConfigured(),
    stripeKeyKind: keyKind,
    priceIdSet: Boolean(NYLEAD_PLAN.stripePriceId),
    webhookSet,
    appUrl: appUrl(),
    recommendedAppUrl: canonicalAppUrl,
    appUrlMismatch,
    webhookPath: "/api/billing/webhook",
    hint,
  });
}
