import { NextResponse } from "next/server";
import { isFakeBillingEnabled } from "@/lib/billing/fake-billing";
import { isStripeFullyConfigured } from "@/lib/billing/stripe";

export async function GET() {
  return NextResponse.json({
    fakeBilling: isFakeBillingEnabled(),
    stripeReady: isStripeFullyConfigured(),
  });
}
