import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { loadListDialLeads } from "@/lib/queues/queue-repository";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Dial-ready firma direkte fra liste (uten kø-steg). */
export async function GET(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const shuffle = url.searchParams.get("shuffle") === "1";

  try {
    const items = await loadListDialLeads(user.id, id, { shuffle });
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke hente liste";
    const status = message === "Listen finnes ikke" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
