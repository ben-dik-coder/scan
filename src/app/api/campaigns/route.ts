import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchCampaigns } from "@/lib/companies";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaigns = await fetchCampaigns(user.id);
    return NextResponse.json(campaigns);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke hente kampanjer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
