import { AGENT_RUN_STALE_MS } from "@/lib/agent/constants";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { AgentConversation, AgentMessage, AgentRun } from "@/types/database";

export function isRunStale(run: AgentRun): boolean {
  const updatedAt = new Date(run.updated_at).getTime();
  if (Number.isNaN(updatedAt)) return true;
  return Date.now() - updatedAt > AGENT_RUN_STALE_MS;
}

export async function cancelRun(
  runId: string,
  errorMessage = "Avbrutt"
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("agent_runs")
    .update({
      status: "failed",
      error_message: errorMessage,
    })
    .eq("id", runId)
    .eq("status", "running");
}

export async function cancelRunningRunsForUser(
  userId: string,
  errorMessage = "Avbrutt av bruker"
): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "running");

  const runIds = (data ?? []).map((row) => row.id as string);
  if (runIds.length === 0) return 0;

  await supabase
    .from("agent_runs")
    .update({
      status: "failed",
      error_message: errorMessage,
    })
    .in("id", runIds)
    .eq("status", "running");

  return runIds.length;
}

export async function getActiveRunForUser(
  userId: string
): Promise<AgentRun | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const run = (data as AgentRun | null) ?? null;
  if (!run) return null;

  if (isRunStale(run)) {
    await cancelRun(run.id, "Utløpt (ingen respons)");
    return null;
  }

  return run;
}

export async function createConversation(
  userId: string,
  title = "Ny samtale"
): Promise<AgentConversation> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_conversations")
    .insert({ user_id: userId, title })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AgentConversation;
}

export async function createRun(
  userId: string,
  conversationId: string,
  params: Record<string, unknown> = {}
): Promise<AgentRun> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("agent_runs")
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      status: "running",
      params,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AgentRun;
}

export async function finishRun(
  runId: string,
  result: Record<string, unknown> | null,
  status: "done" | "failed",
  errorMessage?: string
) {
  const supabase = createServiceClient();
  await supabase
    .from("agent_runs")
    .update({
      status,
      result,
      error_message: errorMessage ?? null,
    })
    .eq("id", runId);
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant" | "tool",
  content: string,
  extras?: { tool_calls?: unknown; tool_name?: string }
) {
  const supabase = await createClient();
  await supabase.from("agent_messages").insert({
    conversation_id: conversationId,
    role,
    content,
    tool_calls: extras?.tool_calls ?? null,
    tool_name: extras?.tool_name ?? null,
  });
  await supabase
    .from("agent_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function loadConversationMessages(
  conversationId: string,
  userId: string
): Promise<AgentMessage[]> {
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("agent_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!conv) return [];

  const { data } = await supabase
    .from("agent_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data ?? []) as AgentMessage[];
}

export function deriveConversationTitle(message: string): string {
  const trimmed = message.trim().slice(0, 60);
  return trimmed.length > 0 ? trimmed : "Ny samtale";
}

export async function getLastResumableRunForConversation(
  conversationId: string,
  userId: string
): Promise<AgentRun | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const run = (data as AgentRun | null) ?? null;
  if (!run) return null;

  const orgnrs = run.progress?.orgnrs;
  if (!Array.isArray(orgnrs) || orgnrs.length === 0) return null;

  return run;
}
