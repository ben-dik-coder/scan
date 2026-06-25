import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import type { SmartListBoardConfig, SmartListKind } from "@/lib/smartliste/types";
import {
  deleteSmartList,
  loadSmartListBoard,
  updateSmartListMeta,
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
    return NextResponse.json(board);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke hente liste";
    const status = message === "Listen finnes ikke" ? 404 : 500;
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
    await updateSmartListMeta(user.id, id, {
      name: typeof body.name === "string" ? body.name : undefined,
      board_config: body.board_config as SmartListBoardConfig | undefined,
      list_kind: body.list_kind as SmartListKind | undefined,
    });
    const board = await loadSmartListBoard(user.id, id);
    return NextResponse.json(board);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke oppdatere liste" },
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
    await deleteSmartList(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke slette liste" },
      { status: 500 }
    );
  }
}
