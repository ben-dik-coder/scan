import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { syncCheckoutSession } from "@/lib/billing/sync-subscription";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";

/** Synk abonnement etter Stripe Checkout (fallback hvis webhook er forsinket) */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Du må være innlogget." }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe er ikke satt opp." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId mangler" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.user_id !== user.id) {
      return NextResponse.json({ error: "Ugyldig betalingsøkt." }, { status: 403 });
    }

    if (session.mode === "subscription" && session.status === "complete") {
      await syncCheckoutSession(session);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[billing/confirm-session]", err);
    const message = err instanceof Error ? err.message : "Kunne ikke bekrefte betaling";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
