import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import type { SmartListItemPatch } from "@/lib/smartliste/types";
import {
  addOrgnrsToSmartList,
  loadSmartListBoard,
  patchSmartListItems,
  removeSmartListItems,
} from "@/lib/smartliste/smart-list-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const patches = (body.patches ?? []) as SmartListItemPatch[];
    if (!Array.isArray(patches) || patches.length === 0) {
      return NextResponse.json({ error: "Ingen endringer" }, { status: 400 });
    }

    await patchSmartListItems(user.id, id, patches);
    const board = await loadSmartListBoard(user.id, id);
    return NextResponse.json(board);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke oppdatere kort" },
      { status: 500 }
    );
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
    const orgnrs = Array.isArray(body.orgnrs) ? body.orgnrs : [];
    const added = await addOrgnrsToSmartList(user.id, id, orgnrs);
    const board = await loadSmartListBoard(user.id, id);
    return NextResponse.json({ board, added });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke legge til firma" },
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
    const body = await request.json();
    const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
    await removeSmartListItems(user.id, id, itemIds);
    const board = await loadSmartListBoard(user.id, id);
    return NextResponse.json(board);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke fjerne kort" },
      { status: 500 }
    );
  }
}
