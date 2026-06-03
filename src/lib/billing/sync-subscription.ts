import type Stripe from "stripe";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  planFromStripePriceId,
  type StoredPlanId,
  type SubscriptionStatus,
} from "@/lib/billing/plans";
import { createServiceClient } from "@/lib/supabase/service";

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const allowed: SubscriptionStatus[] = [
    "active",
    "trialing",
    "past_due",
    "canceled",
    "incomplete",
    "unpaid",
  ];
  if (allowed.includes(status as SubscriptionStatus)) {
    return status as SubscriptionStatus;
  }
  return "canceled";
}

function planFromSubscription(sub: Stripe.Subscription): StoredPlanId | null {
  const priceId = sub.items.data[0]?.price?.id;
  if (!priceId) return null;
  return planFromStripePriceId(priceId);
}

export async function syncSubscriptionToProfile(
  subscription: Stripe.Subscription,
  userId?: string
) {
  const supabase = createServiceClient();
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  let targetUserId = userId;
  if (!targetUserId) {
    const { data: bySub } = await supabase
      .from("profiles")
      .select("id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();
    if (bySub?.id) {
      targetUserId = bySub.id;
    } else {
      const { data: byCustomer } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      targetUserId = byCustomer?.id;
    }
  }

  if (!targetUserId) {
    console.warn("[billing] No profile for subscription", subscription.id);
    return;
  }

  const status = mapStatus(subscription.status);
  const plan = planFromSubscription(subscription);
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  const updates: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    subscription_current_period_end: periodEnd,
  };

  if (plan && ACTIVE_SUBSCRIPTION_STATUSES.includes(status)) {
    updates.plan = plan;
  }

  if (status === "canceled" || status === "unpaid") {
    updates.plan = null;
  }

  await supabase.from("profiles").update(updates).eq("id", targetUserId);
}

export async function syncCheckoutSession(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!userId) {
    console.warn("[billing] checkout.session.completed without user_id metadata");
    return;
  }

  const supabase = createServiceClient();
  if (customerId) {
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
  }

  if (subscriptionId) {
    const { getStripe } = await import("@/lib/billing/stripe");
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    await syncSubscriptionToProfile(sub, userId);
  }
}
