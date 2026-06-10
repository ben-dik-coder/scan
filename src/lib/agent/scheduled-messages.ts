import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { AgentScheduledMessage } from "@/types/database";

export async function listUserScheduledMessages(
  userId: string,
  limit = 50
): Promise<AgentScheduledMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_scheduled_messages")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as AgentScheduledMessage[];
}

export async function createScheduledMessage(
  userId: string,
  message: string,
  scheduledAt: string,
  conversationId?: string | null
): Promise<AgentScheduledMessage> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("agent_scheduled_messages")
    .insert({
      user_id: userId,
      message: message.trim(),
      scheduled_at: scheduledAt,
      conversation_id: conversationId ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as AgentScheduledMessage;
}

export async function cancelScheduledMessage(
  userId: string,
  id: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_scheduled_messages")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function claimDueScheduledMessages(
  limit = 10
): Promise<AgentScheduledMessage[]> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: due, error } = await supabase
    .from("agent_scheduled_messages")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  if (!due?.length) return [];

  const claimed: AgentScheduledMessage[] = [];

  for (const row of due as AgentScheduledMessage[]) {
    const { data: updated } = await supabase
      .from("agent_scheduled_messages")
      .update({ status: "running" })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (updated) claimed.push(updated as AgentScheduledMessage);
  }

  return claimed;
}

export async function finishScheduledMessage(
  id: string,
  status: "done" | "failed",
  result: Record<string, unknown> | null,
  errorMessage?: string,
  conversationId?: string | null
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("agent_scheduled_messages")
    .update({
      status,
      result,
      error_message: errorMessage ?? null,
      ...(conversationId ? { conversation_id: conversationId } : {}),
    })
    .eq("id", id)
    .eq("status", "running");
}
