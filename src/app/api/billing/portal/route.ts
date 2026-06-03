import { NextResponse } from "next/server";
import { getSessionUser, getProfile } from "@/lib/auth";
import { appUrl, getStripe, isStripeConfigured } from "@/lib/billing/stripe";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Du må være innlogget." }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Betaling er ikke satt opp." }, { status: 503 });
  }

  const profile = await getProfile();
  const customerId = profile?.stripe_customer_id;
  if (!customerId || customerId.startsWith("fake_")) {
    return NextResponse.json(
      {
        error:
          "Ingen ekte Stripe-kunde funnet. Velg pakke og betal med kort først (test-abonnement støtter ikke portal).",
      },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl()}/app/abonnement`,
  });

  return NextResponse.json({ url: session.url });
}
