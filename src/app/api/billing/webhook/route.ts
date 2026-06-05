import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { syncCheckoutSession, syncSubscriptionToProfile } from "@/lib/billing/sync-subscription";
import { getStripe, getStripeWebhookSecret } from "@/lib/billing/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = getStripeWebhookSecret();
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret mangler" }, { status: 500 });
  }
  if (!secret.startsWith("whsec_")) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET må starte med whsec_" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Mangler signatur" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("[billing/webhook] Signatur feilet:", err);
    return NextResponse.json({ error: "Ugyldig signatur" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await syncCheckoutSession(session);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionToProfile(subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[billing/webhook]", event.type, err);
    return NextResponse.json({ error: "Webhook handler feilet" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
