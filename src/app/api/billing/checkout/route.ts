import { NextResponse } from "next/server";
import { getSessionUser, getProfile } from "@/lib/auth";
import { activateFakeSubscription, isFakeBillingEnabled } from "@/lib/billing/fake-billing";
import { getPlan, isValidPlanId } from "@/lib/billing/plans";
import { appUrl, getStripe, isStripeConfigured } from "@/lib/billing/stripe";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Du må være innlogget." }, { status: 401 });
  }

  const useFake = isFakeBillingEnabled();

  if (!useFake && !isStripeConfigured()) {
    return NextResponse.json(
      { error: "Betaling er ikke satt opp ennå. Kontakt support." },
      { status: 503 }
    );
  }

  const { planId } = (await request.json()) as { planId?: string };
  if (!planId || !isValidPlanId(planId)) {
    return NextResponse.json({ error: "Ugyldig pakke." }, { status: 400 });
  }

  const plan = getPlan(planId);
  if (!plan) {
    return NextResponse.json({ error: "Ukjent pakke." }, { status: 400 });
  }

  const base = appUrl();

  if (useFake) {
    await activateFakeSubscription(user.id, planId);
    return NextResponse.json({
      url: `${base}/app/abonnement?success=1`,
      fake: true,
    });
  }

  if (!plan.stripePriceId) {
    return NextResponse.json(
      { error: `Stripe-pris for ${plan.name} er ikke konfigurert.` },
      { status: 503 }
    );
  }

  const profile = await getProfile();
  const stripe = getStripe();

  let customerId = profile?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${base}/app/abonnement?success=1`,
    cancel_url: `${base}/app/abonnement?canceled=1`,
    metadata: { user_id: user.id, plan_id: planId },
    subscription_data: {
      metadata: { user_id: user.id, plan_id: planId },
    },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
