import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  getPlan,
  type PlanConfig,
  type PlanId,
} from "@/lib/billing/plans";
import { countCompaniesWithContactThisMonth } from "@/lib/billing/usage";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Profile, SubscriptionStatus } from "@/types/database";

export type Entitlements = {
  hasAccess: boolean;
  isAdmin: boolean;
  plan: PlanId | null;
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
  plan: PlanId,
  status: SubscriptionStatus,
  emailsSentThisMonth: number,
  companiesWithContactUsed: number,
  extras: { isAdmin?: boolean }
): Entitlements {
  return {
    hasAccess: true,
    isAdmin: extras.isAdmin ?? false,
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
  companiesWithContactUsed: number
): Entitlements {
  if (profile.role === "admin") {
    const pro = getPlan("pro")!;
    return buildEntitlements(pro, "pro", "active", emailsSentThisMonth, companiesWithContactUsed, {
      isAdmin: true,
    });
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

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) return NO_ACCESS;

  const [sent, companiesUsed] = await Promise.all([
    countEmailsSentThisMonth(userId),
    countCompaniesWithContactThisMonth(userId),
  ]);
  return entitlementsFromProfile(profile as Profile, sent, companiesUsed);
}

export function requireFeature(
  entitlements: Entitlements,
  feature: "sequences" | "pipeline" | "email"
): string | null {
  if (entitlements.isAdmin) return null;
  if (feature === "email" && !entitlements.emailIntegration) {
    return "Pro eller Byrå kreves for å sende e-post og koble Gmail/Outlook. Oppgrader fra Start.";
  }
  if (feature === "sequences" && !entitlements.sequences) {
    return "Pro eller Byrå kreves for sekvenser. Oppgrader abonnementet ditt.";
  }
  if (feature === "pipeline" && !entitlements.pipeline) {
    return "Pro eller Byrå kreves for pipeline. Oppgrader abonnementet ditt.";
  }
  return null;
}

