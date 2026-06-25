import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  loadSmartListBoard,
  summarizeSmartListItems,
} from "@/lib/smartliste/smart-list-service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const itemIds = Array.isArray(body.itemIds)
      ? body.itemIds.filter((v: unknown): v is string => typeof v === "string")
      : typeof body.itemId === "string"
        ? [body.itemId]
        : [];

    if (itemIds.length === 0) {
      return NextResponse.json({ error: "Velg minst ett kort" }, { status: 400 });
    }

    const summarized = await summarizeSmartListItems(user.id, id, itemIds);
    const board = await loadSmartListBoard(user.id, id);
    return NextResponse.json({ board, summarized });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke lage AI-oppsummering" },
      { status: 500 }
    );
  }
}
