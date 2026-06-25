import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSmsConfig } from "@/lib/sms/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getSmsConfig();
  return NextResponse.json({
    configured: config.configured,
    provider: config.provider,
    from: config.from,
  });
}
