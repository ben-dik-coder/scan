import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCachedWebsiteScans } from "@/lib/website-scan/saved-scans-server";
import {
  buildQueueCandidates,
  mapQueueCandidatesToItems,
} from "@/lib/sales/queue-score";
import type { Company, UserLead } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: leadRows, error: leadsError } = await supabase
      .from("user_leads")
      .select("*")
      .eq("user_id", user.id)
      .not("queued_at", "is", null)
      .in("status", ["ny", "kontaktet"])
      .order("queued_at", { ascending: false });

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    const leads = (leadRows ?? []) as UserLead[];
    if (leads.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const orgnrs = leads.map((l) => l.orgnr);
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("*")
      .in("orgnr", orgnrs);

    if (companiesError) {
      return NextResponse.json({ error: companiesError.message }, { status: 500 });
    }

    const companyRows = (companies ?? []) as Company[];
    const leadsByOrgnr = new Map(leads.map((l) => [l.orgnr, l]));
    const scans = await loadCachedWebsiteScans(orgnrs);
    const scansByOrgnr = new Map(scans.map((s) => [s.orgnr, s]));

    const candidates = buildQueueCandidates(
      companyRows,
      leadsByOrgnr,
      scansByOrgnr
    );

    return NextResponse.json({ items: mapQueueCandidatesToItems(candidates) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke laste arbeidskø";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
