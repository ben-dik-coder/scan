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
  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Ingen Stripe-kunde funnet. Velg en pakke først." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${appUrl()}/app/abonnement`,
  });

  return NextResponse.json({ url: session.url });
}
