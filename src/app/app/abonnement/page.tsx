import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AbonnementClient } from "@/components/billing/AbonnementClient";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getProfile, getSessionUser } from "@/lib/auth";

export const metadata = {
  title: "Abonnement — NyLead",
};

export default async function AbonnementPage() {
  const user = await getSessionUser();
  if (!user) redirect("/innlogging?redirect=/app/abonnement");

  const profile = await getProfile();
  const entitlements = await getEntitlements(user.id);

  return (
    <Suspense fallback={<p className="text-sm text-white/60">Laster…</p>}>
      <AbonnementClient
        profile={{
          plan: profile?.plan ?? null,
          subscription_status: profile?.subscription_status ?? null,
          subscription_current_period_end:
            profile?.subscription_current_period_end ?? null,
        }}
        entitlements={entitlements}
      />
    </Suspense>
  );
}
