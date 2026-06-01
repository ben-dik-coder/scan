import type { PlanId } from "@/lib/billing/plans";
import { isStripeFullyConfigured } from "@/lib/billing/stripe";
import { createServiceClient } from "@/lib/supabase/service";

/** Test-betaling uten Stripe. Standard på når Stripe ikke er fullt satt opp. */
export function isFakeBillingEnabled(): boolean {
  if (process.env.BILLING_FAKE === "false") return false;
  if (process.env.BILLING_FAKE === "true") return true;
  return !isStripeFullyConfigured();
}

export async function activateFakeSubscription(userId: string, planId: PlanId) {
  const supabase = createServiceClient();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { error } = await supabase
    .from("profiles")
    .update({
      plan: planId,
      subscription_status: "active",
      subscription_current_period_end: periodEnd.toISOString(),
      stripe_customer_id: `fake_cus_${userId.slice(0, 8)}`,
      stripe_subscription_id: `fake_sub_${planId}_${userId.slice(0, 8)}`,
    })
    .eq("id", userId);

  if (error) {
    if (error.message.includes("column") || error.code === "42703") {
      throw new Error(
        "Database mangler abonnementsfelt. Kjør migrasjon 004_billing.sql i Supabase."
      );
    }
    throw new Error(error.message);
  }
}
