import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { AGENT_DISABLED_MESSAGE, isAgentEnabled } from "@/lib/agent/constants";
import { loadConversationMessages } from "@/lib/agent/conversations";
import { createClient } from "@/lib/supabase/server";
import type { AgentConversation } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAgentEnabled()) {
    return NextResponse.json({ error: AGENT_DISABLED_MESSAGE }, { status: 503 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("id");

  const supabase = await createClient();

  if (conversationId) {
    const messages = await loadConversationMessages(conversationId, user.id);
    return NextResponse.json({ messages });
  }

  const { data, error } = await supabase
    .from("agent_conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: (data ?? []) as AgentConversation[] });
}

export async function POST(request: Request) {
  if (!isAgentEnabled()) {
    return NextResponse.json({ error: AGENT_DISABLED_MESSAGE }, { status: 503 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_conversations")
    .insert({
      user_id: user.id,
      title: body.title?.trim() || "Ny samtale",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as AgentConversation);
}
