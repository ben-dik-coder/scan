import { NextResponse } from "next/server";
import { getSessionUser, getProfile } from "@/lib/auth";
import { runBrregSync } from "@/lib/brreg/sync";

export async function POST(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");
  const isCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  if (!isCron) {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const profile = await getProfile();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let bootstrap = false;
  let days = 90;
  try {
    const body = await request.json();
    bootstrap = Boolean(body?.bootstrap);
    if (typeof body?.days === "number") days = body.days;
  } catch {
    // empty body ok
  }

  try {
    const result = await runBrregSync({ bootstrap, days });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
