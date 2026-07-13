import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  bulkLoadQueueFromList,
  loadQueueDialLeads,
} from "@/lib/queues/queue-repository";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const listId = typeof body.listId === "string" ? body.listId : "";
    if (!listId) {
      return NextResponse.json({ error: "listId mangler" }, { status: 400 });
    }

    const replace = body.replace === true;
    const result = await bulkLoadQueueFromList(user.id, id, listId, { replace });
    const items = await loadQueueDialLeads(user.id, id);
    return NextResponse.json({ ...result, items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke laste liste inn i kø" },
      { status: 500 }
    );
  }
}
