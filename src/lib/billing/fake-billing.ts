import type { PlanId } from "@/lib/billing/plans";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { createServiceClient } from "@/lib/supabase/service";

/** Test-betaling uten Stripe (lokalt / inntil Stripe er klar). */
export function isFakeBillingEnabled(): boolean {
  if (process.env.BILLING_FAKE === "true") return true;
  if (process.env.BILLING_FAKE === "false") return false;
  return process.env.NODE_ENV === "development" && !isStripeConfigured();
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
    throw new Error(error.message);
  }
}
