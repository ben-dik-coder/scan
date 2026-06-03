import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCachedWebsiteScans } from "@/lib/website-scan/saved-scans-server";
import {
  buildQueueCandidates,
  mapQueueCandidatesToItems,
} from "@/lib/sales/queue-score";
import { forEachOrgnrBatch } from "@/lib/supabase/query-batches";
import type { Company, UserLead } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ORGNR_BATCH_SIZE = 80;

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data: companies, error } = await supabase
      .from("companies")
      .select("*")
      .gte("registered_at", sinceStr)
      .order("registered_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const companyRows = (companies ?? []) as Company[];
    if (companyRows.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const orgnrs = companyRows.map((c) => c.orgnr);

    const leadRows = await forEachOrgnrBatch<UserLead>(
      orgnrs,
      ORGNR_BATCH_SIZE,
      async (batch) => {
        const { data, error: leadsError } = await supabase
          .from("user_leads")
          .select("*")
          .eq("user_id", user.id)
          .in("orgnr", batch);
        if (leadsError) {
          throw new Error(leadsError.message);
        }
        return (data ?? []) as UserLead[];
      }
    );

    const leadsByOrgnr = new Map(leadRows.map((l) => [l.orgnr, l]));
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
