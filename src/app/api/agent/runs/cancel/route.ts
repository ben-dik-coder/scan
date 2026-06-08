import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { AGENT_DISABLED_MESSAGE, isAgentEnabled } from "@/lib/agent/constants";
import { cancelRunningRunsForUser } from "@/lib/agent/conversations";
import { isDemoMode } from "@/lib/demo/config";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isAgentEnabled()) {
    return NextResponse.json({ error: AGENT_DISABLED_MESSAGE }, { status: 503 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Du må være innlogget." }, { status: 401 });
  }

  if (isDemoMode()) {
    return NextResponse.json({ cancelled: 0 });
  }

  const cancelled = await cancelRunningRunsForUser(user.id, "Stoppet av bruker");
  return NextResponse.json({ cancelled });
}
