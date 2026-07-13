import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  deleteWorkQueue,
  loadQueueDialLeads,
  renameWorkQueue,
} from "@/lib/queues/queue-repository";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const items = await loadQueueDialLeads(user.id, id);
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke hente kø";
    const status = message === "Køen finnes ikke" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
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
    if (typeof body.name === "string") {
      await renameWorkQueue(user.id, id, body.name);
    }
    const items = await loadQueueDialLeads(user.id, id);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke oppdatere kø" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteWorkQueue(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke slette kø" },
      { status: 500 }
    );
  }
}
