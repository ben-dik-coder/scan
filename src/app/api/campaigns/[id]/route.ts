import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchCampaignDetail } from "@/lib/companies";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaignId = params.id?.trim();
    if (!campaignId) {
      return NextResponse.json({ error: "Mangler kampanje-id" }, { status: 400 });
    }

    const detail = await fetchCampaignDetail(user.id, campaignId);
    if (!detail) {
      return NextResponse.json({ error: "Kampanje ikke funnet" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke hente kampanje";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
