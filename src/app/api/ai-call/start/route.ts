import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  aiCallConfigErrorMessage,
  isAiCallConfigured,
} from "@/lib/ai-call/config";
import { resolveAiCallTarget } from "@/lib/ai-call/resolve-phone";
import { startAiOutboundCall } from "@/lib/ai-call/start-call";
import { isDemoMode } from "@/lib/demo/config";
import { logActivity, upsertUserLead } from "@/lib/sales/activities";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Company } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isDemoMode()) {
    return NextResponse.json(
      { error: "AI-ring er ikke tilgjengelig i demo-modus" },
      { status: 400 }
    );
  }

  if (!isAiCallConfigured()) {
    return NextResponse.json(
      { error: aiCallConfigErrorMessage() },
      { status: 503 }
    );
  }

  let body: { orgnr?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const orgnr = typeof body.orgnr === "string" ? body.orgnr.trim() : "";
  if (!orgnr) {
    return NextResponse.json({ error: "orgnr er påkrevd" }, { status: 400 });
  }

  const supabase = await createClient();
  const service = createServiceClient();

  const { data: activeRows } = await service
    .from("ai_calls")
    .select("id, status, orgnr")
    .eq("user_id", user.id)
    .in("status", ["queued", "ringing", "in_progress"])
    .limit(1);

  if (activeRows && activeRows.length > 0) {
    return NextResponse.json(
      {
        error: "Du har allerede et aktivt AI-kall. Vent til det er ferdig.",
        activeCallId: activeRows[0]!.id,
      },
      { status: 409 }
    );
  }

  const { data: companyRow, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("orgnr", orgnr)
    .maybeSingle();

  if (companyError) {
    return NextResponse.json({ error: companyError.message }, { status: 500 });
  }
  if (!companyRow) {
    return NextResponse.json({ error: "Firma ikke funnet" }, { status: 404 });
  }

  const company = companyRow as Company;
  const target = await resolveAiCallTarget(company);

  if (target.skippedReason || !target.phoneE164) {
    return NextResponse.json(
      { error: target.skippedReason ?? "Fant ikke telefonnummer" },
      { status: 400 }
    );
  }

  // Persist enriched phone/leder when we found new data
  const phonePatch: Partial<Company> = {};
  if ((target.company.mobile ?? "") !== (company.mobile ?? "")) {
    phonePatch.mobile = target.company.mobile;
  }
  if ((target.company.phone ?? "") !== (company.phone ?? "")) {
    phonePatch.phone = target.company.phone;
  }
  if ((target.company.daglig_leder ?? "") !== (company.daglig_leder ?? "")) {
    phonePatch.daglig_leder = target.company.daglig_leder;
  }
  if (Object.keys(phonePatch).length > 0) {
    await service.from("companies").update(phonePatch).eq("orgnr", orgnr);
  }

  const sellerCompanyName = "North Digital";

  const { data: inserted, error: insertError } = await service
    .from("ai_calls")
    .insert({
      user_id: user.id,
      orgnr,
      phone: target.phoneE164,
      status: "queued",
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Kunne ikke opprette AI-kall" },
      { status: 500 }
    );
  }

  try {
    const started = await startAiOutboundCall({
      customerNumberE164: target.phoneE164,
      promptVars: {
        companyName: target.company.name,
        contactName: target.contactName,
        municipality: target.company.municipality_name,
        phone: target.phoneE164,
        email: target.company.email,
        hasWebsite: Boolean((target.company.website ?? "").trim()),
        sellerCompanyName,
        industryCode: target.company.industry_code,
      },
      metadata: {
        aiCallId: inserted.id as string,
        userId: user.id,
        orgnr,
      },
    });

    const { data: updated, error: updateError } = await service
      .from("ai_calls")
      .update({
        vapi_call_id: started.externalCallId,
        status: "ringing",
        raw_payload: started.raw,
      })
      .eq("id", inserted.id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await upsertUserLead(user.id, orgnr, {
      status: "kontaktet",
      last_contacted_at: new Date().toISOString(),
    });
    await logActivity(user.id, orgnr, "call", "AI-ring startet", {
      ai_call_id: inserted.id,
      provider: started.provider,
      external_call_id: started.externalCallId,
      vapi_call_id: started.externalCallId,
      phone: target.phoneE164,
    });

    return NextResponse.json({
      ok: true,
      provider: started.provider,
      call: updated,
      phone: target.phoneE164,
      contactName: target.contactName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke starte AI-ring";
    await service
      .from("ai_calls")
      .update({
        status: "failed",
        outcome: "other",
        ended_at: new Date().toISOString(),
        summary: message,
      })
      .eq("id", inserted.id);

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
