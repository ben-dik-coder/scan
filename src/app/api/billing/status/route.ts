import { NextResponse } from "next/server";
import { isFakeBillingEnabled } from "@/lib/billing/fake-billing";
import { NYLEAD_PLAN } from "@/lib/billing/plans";
import {
  appUrl,
  getStripeSecretKey,
  isStripeConfigured,
  isStripeFullyConfigured,
} from "@/lib/billing/stripe";

export async function GET() {
  const fakeBilling = isFakeBillingEnabled();
  const stripeReady = isStripeFullyConfigured();
  const secret = getStripeSecretKey();
  const keyKind = secret?.startsWith("sk_live_") || secret?.startsWith("rk_live_")
    ? "live"
    : secret?.startsWith("sk_test_") || secret?.startsWith("rk_test_")
      ? "test"
      : secret?.startsWith("pk_")
        ? "publishable-feil"
        : secret
          ? "ukjent-format"
          : "mangler";
  return NextResponse.json({
    fakeBilling,
    stripeReady,
    stripeKeySet: isStripeConfigured(),
    stripeKeyKind: keyKind,
    priceIdSet: Boolean(NYLEAD_PLAN.stripePriceId),
    appUrl: appUrl(),
    webhookPath: "/api/billing/webhook",
    hint: fakeBilling
      ? "Test-modus: sett BILLING_FAKE=false i Vercel for ekte Stripe."
      : !stripeReady
        ? "Mangler STRIPE_SECRET_KEY eller STRIPE_PRICE i Vercel."
        : "Stripe Checkout er aktiv. Webhook må peke til appUrl + webhookPath.",
  });
}
