import { NextResponse } from "next/server";
import { AGENT_DISABLED_MESSAGE, isAgentEnabled } from "@/lib/agent/constants";
import { processDueScheduledMessages } from "@/lib/agent/process-due-scheduled";
import { resolveAgentRequestAuth } from "@/lib/agent/service-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
    return NextResponse.json({ error: "Du må være innlogget." }, { status: 401 });
  }

  try {
    const result = await processDueScheduledMessages(5);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke kjøre planlagte meldinger";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
