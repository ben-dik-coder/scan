import { createServiceClient } from "@/lib/supabase/service";
import { sendCampaign } from "@/lib/email/send-campaign";
import { logActivity } from "@/lib/sales/activities";

export type ProcessSequencesResult = {
  processed: number;
  sent: number;
  failed: number;
  completed: number;
};

export async function processDueSequences(
  userId?: string
): Promise<ProcessSequencesResult> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("sequence_enrollments")
    .select(
      `
      id, user_id, sequence_id, orgnr, current_step, status,
      companies (orgnr, name, email, has_email, email_is_generic)
    `
    )
    .eq("status", "active")
    .lte("next_send_at", now)
    .limit(50);

  if (userId) query = query.eq("user_id", userId);

  const { data: due, error } = await query;
  if (error) throw new Error(error.message);

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let completed = 0;

  for (const enrollment of due ?? []) {
    processed += 1;
    const companyRaw = enrollment.companies as unknown;
    const company = (Array.isArray(companyRaw) ? companyRaw[0] : companyRaw) as {
      orgnr: string;
      name: string;
      email: string | null;
      has_email: boolean;
    } | null;

    if (!company?.email || !company.has_email) {
      await supabase
        .from("sequence_enrollments")
        .update({ status: "failed" })
        .eq("id", enrollment.id);
      failed += 1;
      continue;
    }

    const { data: steps } = await supabase
      .from("email_sequence_steps")
      .select("*")
      .eq("sequence_id", enrollment.sequence_id)
      .order("step_order", { ascending: true });

    const step = (steps ?? []).find(
      (s) => s.step_order === enrollment.current_step
    );

    if (!step) {
      await supabase
        .from("sequence_enrollments")
        .update({ status: "completed", next_send_at: null })
        .eq("id", enrollment.id);
      completed += 1;
      continue;
    }

    const result = await sendCampaign(enrollment.user_id, {
      subject: step.subject,
      body: step.body,
      recipients: [
        {
          orgnr: company.orgnr,
          email: company.email,
          name: company.name,
        },
      ],
      allowPersonal: false,
    });

    if (result.sent > 0) {
      sent += 1;
      await logActivity(
        enrollment.user_id,
        company.orgnr,
        "sequence_sent",
        `Sekvens steg ${enrollment.current_step + 1} sendt`,
        { sequence_id: enrollment.sequence_id, step: enrollment.current_step }
      );
    } else {
      failed += 1;
    }

    const nextStep = enrollment.current_step + 1;
    const nextStepData = (steps ?? []).find((s) => s.step_order === nextStep);

    if (!nextStepData) {
      await supabase
        .from("sequence_enrollments")
        .update({
          status: "completed",
          current_step: nextStep,
          last_sent_at: now,
          next_send_at: null,
        })
        .eq("id", enrollment.id);
      completed += 1;
    } else {
      const nextSend = new Date();
      nextSend.setDate(nextSend.getDate() + nextStepData.delay_days);
      await supabase
        .from("sequence_enrollments")
        .update({
          current_step: nextStep,
          last_sent_at: now,
          next_send_at: nextSend.toISOString(),
        })
        .eq("id", enrollment.id);
    }
  }

  return { processed, sent, failed, completed };
}

export async function enrollInSequence(
  userId: string,
  sequenceId: string,
  orgnrs: string[]
) {
  const supabase = createServiceClient();

  const { data: steps } = await supabase
    .from("email_sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true });

  if (!steps?.length) throw new Error("Sekvensen har ingen steg");

  const firstStep = steps[0];
  const nextSend = new Date();
  nextSend.setDate(nextSend.getDate() + firstStep.delay_days);

  for (const orgnr of orgnrs) {
    await supabase.from("sequence_enrollments").upsert(
      {
        user_id: userId,
        sequence_id: sequenceId,
        orgnr,
        current_step: 0,
        status: "active",
        enrolled_at: new Date().toISOString(),
        next_send_at: nextSend.toISOString(),
      },
      { onConflict: "user_id,sequence_id,orgnr" }
    );

    await logActivity(
      userId,
      orgnr,
      "sequence_enrolled",
      "Påmeldt e-postsekvens",
      { sequence_id: sequenceId }
    );
  }
}

export async function pauseEnrollmentsOnReply(userId: string, orgnr: string) {
  const supabase = createServiceClient();
  await supabase
    .from("sequence_enrollments")
    .update({ status: "replied", next_send_at: null })
    .eq("user_id", userId)
    .eq("orgnr", orgnr)
    .eq("status", "active");

  await logActivity(userId, orgnr, "sequence_paused", "Sekvens pauset pga. svar");
}

export async function seedDefaultSalesAssets(userId: string) {
  const supabase = createServiceClient();

  const { count } = await supabase
    .from("email_templates")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count ?? 0) > 0) return;

  const { DEFAULT_TEMPLATES, DEFAULT_SEQUENCE } = await import("./constants");

  await supabase.from("email_templates").insert(
    DEFAULT_TEMPLATES.map((t, i) => ({
      user_id: userId,
      name: t.name,
      subject: t.subject,
      body: t.body,
      is_default: i === 0,
    }))
  );

  const { data: seq } = await supabase
    .from("email_sequences")
    .insert({ user_id: userId, name: DEFAULT_SEQUENCE.name, active: true })
    .select("id")
    .single();

  if (seq) {
    await supabase.from("email_sequence_steps").insert(
      DEFAULT_SEQUENCE.steps.map((s) => ({
        sequence_id: seq.id,
        ...s,
      }))
    );
  }
}
