import { createServiceClient } from "@/lib/supabase/service";

const ALLOWED_KEYS = new Set([
  "default_municipality",
  "default_region",
  "default_industry",
  "default_profession",
  "sales_focus",
  "notes",
]);

export type AgentUserMemoryEntry = {
  key: string;
  value: string;
};

export async function loadUserMemory(
  userId: string
): Promise<AgentUserMemoryEntry[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_user_memory")
    .select("memory_key, memory_value")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return (data ?? []).map((row) => ({
    key: String(row.memory_key),
    value: String(row.memory_value),
  }));
}

export async function loadUserMemoryPrompt(userId: string): Promise<string> {
  const entries = await loadUserMemory(userId);
  if (entries.length === 0) return "";

  const lines = entries.map((e) => `- ${e.key}: ${e.value}`);
  return `BRUKER-PREFERANSER (husk disse):\n${lines.join("\n")}`;
}

export async function upsertUserMemory(
  userId: string,
  key: string,
  value: string
): Promise<void> {
  const trimmedKey = key.trim();
  const trimmedValue = value.trim();
  if (!trimmedKey || !trimmedValue) return;
  if (!ALLOWED_KEYS.has(trimmedKey)) {
    throw new Error(`Ugyldig minne-nøkkel: ${trimmedKey}`);
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("agent_user_memory").upsert(
    {
      user_id: userId,
      memory_key: trimmedKey,
      memory_value: trimmedValue,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,memory_key" }
  );

  if (error) throw new Error(error.message);
}
