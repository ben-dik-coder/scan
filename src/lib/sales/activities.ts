import { createServiceClient } from "@/lib/supabase/service";
import type { ActivityType } from "./constants";

export async function logActivity(
  userId: string,
  orgnr: string,
  activityType: ActivityType,
  description: string,
  metadata: Record<string, unknown> = {}
) {
  const supabase = createServiceClient();
  await supabase.from("lead_activities").insert({
    user_id: userId,
    orgnr,
    activity_type: activityType,
    description,
    metadata,
  });
}

export async function upsertUserLead(
  userId: string,
  orgnr: string,
  updates: {
    status?: string;
    score?: number;
    notes?: string;
    last_contacted_at?: string;
    next_follow_up_at?: string | null;
  }
) {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("user_leads")
    .select("status, notes")
    .eq("user_id", userId)
    .eq("orgnr", orgnr)
    .maybeSingle();

  const payload = {
    user_id: userId,
    orgnr,
    ...updates,
  };

  await supabase.from("user_leads").upsert(payload, {
    onConflict: "user_id,orgnr",
  });

  if (updates.status && existing?.status !== updates.status) {
    await logActivity(
      userId,
      orgnr,
      "status_changed",
      `Status endret til ${updates.status}`,
      { from: existing?.status, to: updates.status }
    );
  }

  if (updates.notes !== undefined && updates.notes !== existing?.notes) {
    await logActivity(userId, orgnr, "note_added", "Notat oppdatert");
  }

  if (updates.next_follow_up_at) {
    await logActivity(
      userId,
      orgnr,
      "follow_up_set",
      `Oppfølging satt til ${updates.next_follow_up_at}`,
      { next_follow_up_at: updates.next_follow_up_at }
    );
  }
}

export async function deleteUserLead(userId: string, orgnr: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("user_leads")
    .delete()
    .eq("user_id", userId)
    .eq("orgnr", orgnr);

  if (error) {
    throw new Error(error.message);
  }

  await logActivity(userId, orgnr, "status_changed", "Lead slettet fra kø");
}
