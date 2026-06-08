import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSerperUsage } from "@/lib/billing/serper-usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  }

  const usage = await getSerperUsage(user.id);
  return NextResponse.json(usage);
}
