import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCachedWebsiteScans } from "@/lib/website-scan/saved-scans-server";
import {
  buildListRingCandidates,
  buildQueueCandidates,
  mapQueueCandidatesToItems,
} from "@/lib/sales/queue-score";
import type { Company, UserLead } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ORGNR_CHUNK = 100;

function parseOrgnrs(value: string | null): string[] {
  if (!value?.trim()) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((orgnr) => orgnr.trim())
        .filter(Boolean)
    )
  );
}

async function fetchCompaniesInChunks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgnrs: string[]
): Promise<Company[]> {
  const rows: Company[] = [];
  for (let i = 0; i < orgnrs.length; i += ORGNR_CHUNK) {
    const chunk = orgnrs.slice(i, i + ORGNR_CHUNK);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .in("orgnr", chunk);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Company[]));
  }
  return rows;
}

async function fetchLeadsInChunks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgnrs: string[]
): Promise<UserLead[]> {
  const rows: UserLead[] = [];
  for (let i = 0; i < orgnrs.length; i += ORGNR_CHUNK) {
    const chunk = orgnrs.slice(i, i + ORGNR_CHUNK);
    const { data, error } = await supabase
      .from("user_leads")
      .select("*")
      .eq("user_id", userId)
      .in("orgnr", chunk);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as UserLead[]));
  }
  return rows;
}

/** Ring fra lagret liste: alle orgnr i lista, uten krav om arbeidskø. */
async function loadFromListOrgnrs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgnrs: string[]
) {
  const [companyRows, leads] = await Promise.all([
    fetchCompaniesInChunks(supabase, orgnrs),
    fetchLeadsInChunks(supabase, userId, orgnrs),
  ]);
  const leadsByOrgnr = new Map(leads.map((l) => [l.orgnr, l]));
  const scans = await loadCachedWebsiteScans(orgnrs);
  const scansByOrgnr = new Map(scans.map((s) => [s.orgnr, s]));
  const candidates = buildListRingCandidates(
    orgnrs,
    companyRows,
    leadsByOrgnr,
    scansByOrgnr
  );
  return mapQueueCandidatesToItems(candidates);
}

/** Vanlig arbeidskø: kun leads med queued_at. */
async function loadWorkQueue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data: leadRows, error: leadsError } = await supabase
    .from("user_leads")
    .select("*")
    .eq("user_id", userId)
    .not("queued_at", "is", null)
    .in("status", ["ny", "kontaktet", "svarte"])
    .order("queued_at", { ascending: false });

  if (leadsError) {
    throw new Error(leadsError.message);
  }

  const leads = (leadRows ?? []) as UserLead[];
  if (leads.length === 0) {
    return [];
  }

  const orgnrs = leads.map((l) => l.orgnr);
  const companyRows = await fetchCompaniesInChunks(supabase, orgnrs);
  const leadsByOrgnr = new Map(leads.map((l) => [l.orgnr, l]));
  const scans = await loadCachedWebsiteScans(orgnrs);
  const scansByOrgnr = new Map(scans.map((s) => [s.orgnr, s]));

  const candidates = buildQueueCandidates(
    companyRows,
    leadsByOrgnr,
    scansByOrgnr
  );
  return mapQueueCandidatesToItems(candidates);
}

async function handleKoRequest(orgnrs: string[]) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const items =
    orgnrs.length > 0
      ? await loadFromListOrgnrs(supabase, user.id, orgnrs)
      : await loadWorkQueue(supabase, user.id);

  return NextResponse.json({
    items,
    mode: orgnrs.length > 0 ? "list" : "queue",
  });
}

export async function GET(request: Request) {
  try {
    const orgnrs = parseOrgnrs(new URL(request.url).searchParams.get("orgnrs"));
    return await handleKoRequest(orgnrs);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Kunne ikke laste arbeidskø";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Ring fra liste: send orgnrs i body (tryggere enn lang query-string). */
export async function POST(request: Request) {
  try {
    let body: { orgnrs?: unknown } = {};
    try {
      body = (await request.json()) as { orgnrs?: unknown };
    } catch {
      body = {};
    }
    const orgnrs = Array.isArray(body.orgnrs)
      ? Array.from(
          new Set(
            body.orgnrs
              .filter((o): o is string => typeof o === "string")
              .map((o) => o.trim())
              .filter(Boolean)
          )
        )
      : [];
    return await handleKoRequest(orgnrs);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Kunne ikke laste arbeidskø";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
