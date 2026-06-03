import { isBillingFreeEmail } from "@/lib/billing/billing-free";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  getPlan,
  NYLEAD_PLAN,
  type PlanConfig,
  type StoredPlanId,
} from "@/lib/billing/plans";
import { countCompaniesWithContactThisMonth } from "@/lib/billing/usage";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Profile, SubscriptionStatus } from "@/types/database";

export type Entitlements = {
  hasAccess: boolean;
  isAdmin: boolean;
  /** Gratis tilgang via BILLING_FREE_EMAILS (plattform-eier) */
  isBillingFree: boolean;
  plan: StoredPlanId | null;
  planConfig: PlanConfig | null;
  subscriptionStatus: SubscriptionStatus | null;
  maxRecipientsPerSend: number;
  maxEmailsPerMonth: number;
  maxCompaniesWithContactPerMonth: number;
  maxTemplates: number | null;
  emailIntegration: boolean;
  sequences: boolean;
  pipeline: boolean;
  emailsSentThisMonth: number;
  emailsRemainingThisMonth: number;
  companiesWithContactUsed: number;
  companiesWithContactRemaining: number;
};

const NO_ACCESS: Entitlements = {
  hasAccess: false,
  isAdmin: false,
  isBillingFree: false,
  plan: null,
  planConfig: null,
  subscriptionStatus: null,
  maxRecipientsPerSend: 0,
  maxEmailsPerMonth: 0,
  maxCompaniesWithContactPerMonth: 0,
  maxTemplates: 0,
  emailIntegration: false,
  sequences: false,
  pipeline: false,
  emailsSentThisMonth: 0,
  emailsRemainingThisMonth: 0,
  companiesWithContactUsed: 0,
  companiesWithContactRemaining: 0,
};

function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export async function countEmailsSentThisMonth(userId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("email_campaigns")
    .select("sent_count")
    .eq("user_id", userId)
    .gte("created_at", monthStartIso());

  return (data ?? []).reduce((sum, row) => sum + (row.sent_count ?? 0), 0);
}

function buildEntitlements(
  planConfig: PlanConfig,
  plan: StoredPlanId,
  status: SubscriptionStatus,
  emailsSentThisMonth: number,
  companiesWithContactUsed: number,
  extras: { isAdmin?: boolean; isBillingFree?: boolean }
): Entitlements {
  return {
    hasAccess: true,
    isAdmin: extras.isAdmin ?? false,
    isBillingFree: extras.isBillingFree ?? false,
    plan,
    planConfig,
    subscriptionStatus: status,
    maxRecipientsPerSend: planConfig.maxRecipientsPerSend,
    maxEmailsPerMonth: planConfig.maxEmailsPerMonth,
    maxCompaniesWithContactPerMonth: planConfig.maxCompaniesWithContactPerMonth,
    maxTemplates: planConfig.maxTemplates,
    emailIntegration: planConfig.emailIntegration,
    sequences: planConfig.sequences,
    pipeline: planConfig.pipeline,
    emailsSentThisMonth,
    emailsRemainingThisMonth: Math.max(
      0,
      planConfig.maxEmailsPerMonth - emailsSentThisMonth
    ),
    companiesWithContactUsed,
    companiesWithContactRemaining: Math.max(
      0,
      planConfig.maxCompaniesWithContactPerMonth - companiesWithContactUsed
    ),
  };
}

export function entitlementsFromProfile(
  profile: Profile,
  emailsSentThisMonth: number,
  companiesWithContactUsed: number,
  email?: string | null
): Entitlements {
  if (profile.role === "admin") {
    return buildEntitlements(
      NYLEAD_PLAN,
      "nylead",
      "active",
      emailsSentThisMonth,
      companiesWithContactUsed,
      { isAdmin: true }
    );
  }

  if (isBillingFreeEmail(email)) {
    return buildEntitlements(
      NYLEAD_PLAN,
      "nylead",
      "active",
      emailsSentThisMonth,
      companiesWithContactUsed,
      { isBillingFree: true }
    );
  }

  const status = profile.subscription_status;
  const active =
    status && ACTIVE_SUBSCRIPTION_STATUSES.includes(status) && profile.plan;

  if (!active || !profile.plan) {
    return { ...NO_ACCESS, emailsSentThisMonth, companiesWithContactUsed };
  }

  const planConfig = getPlan(profile.plan);
  if (!planConfig) {
    return { ...NO_ACCESS, emailsSentThisMonth, companiesWithContactUsed };
  }

  return buildEntitlements(
    planConfig,
    profile.plan,
    status,
    emailsSentThisMonth,
    companiesWithContactUsed,
    { isAdmin: false }
  );
}

export async function getEntitlements(
  userId: string,
  email?: string | null
): Promise<Entitlements> {
  const supabase = await createClient();
  const [{ data: profile }, authResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    email === undefined
      ? supabase.auth.getUser()
      : Promise.resolve({ data: { user: null } }),
  ]);

  if (!profile) return NO_ACCESS;

  const userEmail =
    email !== undefined ? email : authResult.data.user?.email ?? null;

  const [sent, companiesUsed] = await Promise.all([
    countEmailsSentThisMonth(userId),
    countCompaniesWithContactThisMonth(userId),
  ]);
  return entitlementsFromProfile(
    profile as Profile,
    sent,
    companiesUsed,
    userEmail
  );
}

export function requireFeature(
  entitlements: Entitlements,
  feature: "sequences" | "pipeline" | "email"
): string | null {
  if (entitlements.isAdmin || entitlements.isBillingFree) return null;
  if (feature === "email" && !entitlements.emailIntegration) {
    return "Aktivt NyLead-abonnement kreves for å sende e-post og koble Gmail/Outlook.";
  }
  if (feature === "sequences" && !entitlements.sequences) {
    return "Aktivt NyLead-abonnement kreves for sekvenser.";
  }
  if (feature === "pipeline" && !entitlements.pipeline) {
    return "Aktivt NyLead-abonnement kreves for pipeline.";
  }
  return null;
}

