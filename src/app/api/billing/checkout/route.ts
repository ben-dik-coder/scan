import { NextResponse } from "next/server";
import { getSessionUser, getProfile } from "@/lib/auth";
import { isBillingFreeEmail } from "@/lib/billing/billing-free";
import { activateFakeSubscription, isFakeBillingEnabled } from "@/lib/billing/fake-billing";
import { DEFAULT_PLAN_ID, getPlan, isValidPlanId } from "@/lib/billing/plans";
import {
  countActiveSubscribers,
  isSubscriberCapReached,
} from "@/lib/billing/subscriber-cap";
import { appUrl, getStripe, isStripeConfigured, stripeSecretKeyError } from "@/lib/billing/stripe";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Du må være innlogget." }, { status: 401 });
    }

    if (isBillingFreeEmail(user.email)) {
      return NextResponse.json(
        { error: "Du har gratis tilgang og trenger ikke abonnement." },
        { status: 400 }
      );
    }

    const useFake = isFakeBillingEnabled();

    if (!useFake && !isStripeConfigured()) {
      return NextResponse.json(
        { error: "Betaling er ikke satt opp ennå. Kontakt support." },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { planId?: string };
    const planId =
      body.planId && isValidPlanId(body.planId) ? body.planId : DEFAULT_PLAN_ID;

    const plan = getPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: "Ukjent pakke." }, { status: 400 });
    }

    try {
      const realCount = await countActiveSubscribers();
      if (isSubscriberCapReached(realCount)) {
        return NextResponse.json(
          {
            error:
              "Alle sitteplasser er fullte. Kontakt post@nylead.no for venteliste.",
            full: true,
          },
          { status: 403 }
        );
      }
    } catch (err) {
      console.error("[billing/checkout] cap check failed:", err);
    }

    const base = appUrl();

    if (useFake) {
      try {
        await activateFakeSubscription(user.id, planId);
      } catch (err) {
        console.error("[billing/checkout] fake activate failed:", err);
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Kunne ikke aktivere test-abonnement.",
          },
          { status: 500 }
        );
      }
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
    const supabase = createServiceClient();

    let customerId = profile?.stripe_customer_id ?? undefined;
    if (customerId?.startsWith("fake_")) {
      customerId = undefined;
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);

      if (updateError) {
        console.error("[billing/checkout] profile update:", updateError);
        // Fortsett — Checkout kan fortsatt fungere uten lagret customer_id
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${base}/app/abonnement?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/app/abonnement?canceled=1`,
      metadata: { user_id: user.id, plan_id: planId },
      subscription_data: {
        metadata: { user_id: user.id, plan_id: planId },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe returnerte ingen betalingslenke." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/checkout] unhandled:", err);
    const raw = err instanceof Error ? err.message : "Ukjent feil";
    const configError = stripeSecretKeyError();
    const hint =
      configError && !raw.includes("STRIPE_SECRET_KEY")
        ? ` ${configError}`
        : raw.includes("No such price") || raw.includes("resource_missing")
          ? " STRIPE_PRICE i Vercel må matche en aktiv pris i Stripe (samme test/live-modus som nøkkelen)."
          : raw.includes("Invalid API Key") || raw.includes("api_key")
            ? " STRIPE_SECRET_KEY i Vercel matcher ikke en gyldig Stripe Secret key."
            : raw.includes("Missing Supabase")
              ? " Supabase service role mangler i Vercel."
              : "";
    return NextResponse.json(
      { error: `Kunne ikke starte betaling: ${raw}${hint}` },
      { status: 500 }
    );
  }
}
