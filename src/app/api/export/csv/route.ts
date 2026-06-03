import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCachedWebsiteScans } from "@/lib/website-scan/saved-scans-server";
import { resolveCompanyEmail } from "@/lib/website-scan/resolve-company-email";
import { postExportWebhook } from "@/lib/export/webhook";
import { fetchDagligLeder } from "@/lib/brreg/roles";
import { createServiceClient } from "@/lib/supabase/service";

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const orgnrs = Array.isArray(body.orgnrs)
    ? body.orgnrs.filter((o: unknown) => typeof o === "string")
    : [];
  const triggerWebhook = Boolean(body.triggerWebhook);

  if (orgnrs.length === 0) {
    return NextResponse.json({ error: "Velg minst ett firma." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: companies, error } = await supabase
    .from("companies")
    .select("*")
    .in("orgnr", orgnrs);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: leads } = await supabase
    .from("user_leads")
    .select("orgnr, score")
    .eq("user_id", user.id)
    .in("orgnr", orgnrs);

  const scoreByOrgnr = new Map((leads ?? []).map((l) => [l.orgnr, l.score]));
  const scans = await loadCachedWebsiteScans(orgnrs);
  const scanByOrgnr = new Map(scans.map((s) => [s.orgnr, s]));

  const service = createServiceClient();
  const rows: Array<Record<string, string>> = [];

  for (const c of companies ?? []) {
    const scan = scanByOrgnr.get(c.orgnr);
    const resolved = resolveCompanyEmail(c, scan);
    let dagligLeder = c.daglig_leder as string | null;
    if (!dagligLeder) {
      dagligLeder = await fetchDagligLeder(c.orgnr);
      if (dagligLeder) {
        await service
          .from("companies")
          .update({ daglig_leder: dagligLeder })
          .eq("orgnr", c.orgnr);
      }
    }

    rows.push({
      orgnr: c.orgnr,
      name: c.name,
      email: resolved?.email ?? c.email ?? "",
      phone: c.phone ?? c.mobile ?? "",
      website: scan?.websiteUrl ?? c.website ?? "",
      facebook: scan?.facebookUrl ?? "",
      instagram: scan?.instagramUrl ?? "",
      score: String(scoreByOrgnr.get(c.orgnr) ?? ""),
      daglig_leder: dagligLeder ?? "",
    });
  }

  const header = [
    "orgnr",
    "navn",
    "epost",
    "telefon",
    "nettside",
    "facebook",
    "instagram",
    "score",
    "daglig_leder",
  ];
  const csvLines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.orgnr,
        r.name,
        r.email,
        r.phone,
        r.website,
        r.facebook,
        r.instagram,
        r.score,
        r.daglig_leder,
      ]
        .map((v) => csvEscape(v))
        .join(",")
    ),
  ];
  const csv = csvLines.join("\n");

  let webhookOk: boolean | undefined;
  let webhookError: string | undefined;

  if (triggerWebhook) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("webhook_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (settings?.webhook_url) {
      const result = await postExportWebhook(settings.webhook_url, {
        event: "export",
        exportedAt: new Date().toISOString(),
        count: rows.length,
        companies: rows.map((r) => ({
          orgnr: r.orgnr,
          name: r.name,
          email: r.email || null,
          phone: r.phone || null,
          website: r.website || null,
          facebookUrl: r.facebook || null,
          instagramUrl: r.instagram || null,
          score: r.score ? Number(r.score) : null,
          dagligLeder: r.daglig_leder || null,
        })),
      });
      webhookOk = result.ok;
      webhookError = result.error;
    }
  }

  return NextResponse.json({
    csv,
    count: rows.length,
    webhookOk,
    webhookError,
  });
}
