import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  createWorkQueue,
  listWorkQueues,
} from "@/lib/queues/queue-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const queues = await listWorkQueues(user.id);
    return NextResponse.json({ queues });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke hente køer" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name : "Ny kø";
    const sourceListId =
      typeof body.sourceListId === "string" ? body.sourceListId : null;
    const queue = await createWorkQueue(user.id, name, sourceListId);
    return NextResponse.json({ queue });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke opprette kø" },
      { status: 500 }
    );
  }
}
