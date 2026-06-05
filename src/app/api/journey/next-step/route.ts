import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchSalesDashboard } from "@/lib/companies";
import { listMailAccounts } from "@/lib/email/oauth/accounts";
import { computeNextStep } from "@/lib/sales/next-step";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const [accounts, dashboard, queueRes, nyQueueRes] = await Promise.all([
      listMailAccounts(user.id),
      fetchSalesDashboard(user.id),
      supabase
        .from("user_leads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("queued_at", "is", null)
        .in("status", ["ny", "kontaktet"]),
      supabase
        .from("user_leads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("queued_at", "is", null)
        .eq("status", "ny"),
    ]);

    const step = computeNextStep({
      emailConnected: accounts.length > 0,
      queuedCount: queueRes.count ?? 0,
      queuedNyCount: nyQueueRes.count ?? 0,
      dueFollowUps: dashboard.dueFollowUps,
      totalLeads: dashboard.totalLeads,
      totalSent: dashboard.totalSent,
    });

    return NextResponse.json(step);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke hente neste steg";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
