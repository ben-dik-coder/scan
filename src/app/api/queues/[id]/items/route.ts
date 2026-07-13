import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  addQueueItems,
  loadQueueDialLeads,
  removeQueueItems,
  reorderQueueItems,
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
    const orgnrs = Array.isArray(body.orgnrs)
      ? body.orgnrs.filter((o: unknown): o is string => typeof o === "string")
      : [];

    const added = await addQueueItems(user.id, id, orgnrs);
    const items = await loadQueueDialLeads(user.id, id);
    return NextResponse.json({ added, items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke legge til i kø" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();

    if (Array.isArray(body.orderedOrgnrs)) {
      const orderedOrgnrs = body.orderedOrgnrs.filter(
        (o: unknown): o is string => typeof o === "string"
      );
      await reorderQueueItems(user.id, id, orderedOrgnrs);
    }

    const items = await loadQueueDialLeads(user.id, id);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke oppdatere rekkefølge" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const orgnrs = Array.isArray(body.orgnrs)
      ? body.orgnrs.filter((o: unknown): o is string => typeof o === "string")
      : [];

    await removeQueueItems(user.id, id, orgnrs);
    const items = await loadQueueDialLeads(user.id, id);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke fjerne fra kø" },
      { status: 500 }
    );
  }
}
