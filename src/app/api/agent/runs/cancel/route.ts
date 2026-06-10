import { NextRequest, NextResponse } from "next/server";
import { AGENT_DISABLED_MESSAGE, isAgentEnabled } from "@/lib/agent/constants";
import { cancelRunningRunsForUser } from "@/lib/agent/conversations";
import { resolveAgentRequestAuth } from "@/lib/agent/service-auth";
import { isDemoMode } from "@/lib/demo/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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

  if (isDemoMode()) {
    return NextResponse.json({ cancelled: 0 });
  }

  const cancelled = await cancelRunningRunsForUser(user.id, "Stoppet av bruker");
  return NextResponse.json({ cancelled });
}
