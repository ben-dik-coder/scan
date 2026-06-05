import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchLeadActivities } from "@/lib/companies";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgnr: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgnr } = await params;

  try {
    const activities = await fetchLeadActivities(user.id, orgnr);
    return NextResponse.json({ activities });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke hente aktivitet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
