import { NextResponse } from "next/server";
import { isAgentEnabled } from "@/lib/agent/constants";
import { processDueScheduledMessages } from "@/lib/agent/process-due-scheduled";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  return request.headers.get("x-cron-secret") === cronSecret;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAgentEnabled()) {
    return NextResponse.json({ skipped: true, reason: "agent disabled" });
  }

  try {
    const result = await processDueScheduledMessages(5);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
