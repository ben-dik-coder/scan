import { NextResponse } from "next/server";
import { AGENT_DISABLED_MESSAGE, isAgentEnabled } from "@/lib/agent/constants";
import { resolveAgentRequestAuth } from "@/lib/agent/service-auth";
import {
  enforceConversationLimit,
  listUserConversations,
  loadConversationMessages,
} from "@/lib/agent/conversations";
import { createClient } from "@/lib/supabase/server";
import type { AgentConversation } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAgentEnabled()) {
    return NextResponse.json({ error: AGENT_DISABLED_MESSAGE }, { status: 503 });
  }

  const auth = await resolveAgentRequestAuth(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const { user } = auth;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("id");

  if (conversationId) {
    const messages = await loadConversationMessages(conversationId, user.id);
    return NextResponse.json({ messages });
  }

  try {
    const conversations = await listUserConversations(user.id);
    return NextResponse.json({ conversations });
  } catch (listError) {
    const message =
      listError instanceof Error ? listError.message : "Kunne ikke hente samtaler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAgentEnabled()) {
    return NextResponse.json({ error: AGENT_DISABLED_MESSAGE }, { status: 503 });
  }

  const auth = await resolveAgentRequestAuth(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const { user } = auth;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  await enforceConversationLimit(user.id);

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
