import { NextResponse } from "next/server";
import { isFakeBillingEnabled } from "@/lib/billing/fake-billing";
import { NYLEAD_PLAN } from "@/lib/billing/plans";
import {
  appUrl,
  getStripeKeyKind,
  getStripeWebhookSecret,
  isStripeConfigured,
  isStripeFullyConfigured,
  stripeSecretKeyDebugInfo,
  stripeSecretKeyError,
} from "@/lib/billing/stripe";

export async function GET() {
  const fakeBilling = isFakeBillingEnabled();
  const stripeReady = isStripeFullyConfigured();
  const keyKind = getStripeKeyKind();
  const webhookSecret = getStripeWebhookSecret();
  const webhookSet = Boolean(webhookSecret?.startsWith("whsec_"));
  const configError = stripeSecretKeyError();
  const canonicalAppUrl =
    process.env.VERCEL_ENV === "production" ? "https://nylead.no" : appUrl();
  const appUrlMismatch =
    process.env.VERCEL_ENV === "production" &&
    appUrl() !== canonicalAppUrl;

  let hint: string;
  if (configError) {
    hint = configError;
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
    stripeKeyDebug: stripeSecretKeyDebugInfo(),
    priceIdSet: Boolean(NYLEAD_PLAN.stripePriceId),
    webhookSet,
    appUrl: appUrl(),
    recommendedAppUrl: canonicalAppUrl,
    appUrlMismatch,
    webhookPath: "/api/billing/webhook",
    hint,
  });
}
