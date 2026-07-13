import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  createSmartListLane,
  loadSmartListBoard,
  updateSmartListLane,
} from "@/lib/smartliste/smart-list-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const board = await loadSmartListBoard(user.id, id);
    return NextResponse.json({ lanes: board.lanes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke hente soner";
    const status = message === "Listen finnes ikke" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const color = typeof body.color === "string" ? body.color : "sky";
    if (!name) {
      return NextResponse.json({ error: "Navn mangler" }, { status: 400 });
    }

    const lane = await createSmartListLane(user.id, id, name, color);
    const board = await loadSmartListBoard(user.id, id);
    return NextResponse.json({ lane, board });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke opprette sone" },
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
    const laneId = typeof body.laneId === "string" ? body.laneId : "";
    if (!laneId) {
      return NextResponse.json({ error: "laneId mangler" }, { status: 400 });
    }

    await updateSmartListLane(user.id, id, laneId, {
      name: typeof body.name === "string" ? body.name : undefined,
      color: typeof body.color === "string" ? body.color : undefined,
      sort_order: typeof body.sort_order === "number" ? body.sort_order : undefined,
    });

    const board = await loadSmartListBoard(user.id, id);
    return NextResponse.json({ board });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke oppdatere sone" },
      { status: 500 }
    );
  }
}
