import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { processDueSequences } from "@/lib/sales/sequences";

export async function POST(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");
  const isCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  let userId: string | undefined;

  if (!isCron) {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
  }

  try {
    const result = await processDueSequences(userId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Process failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
