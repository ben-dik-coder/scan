import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  loadSmartListBoard,
  rankSmartList,
} from "@/lib/smartliste/smart-list-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const ranked = await rankSmartList(user.id, id);
    const board = await loadSmartListBoard(user.id, id);
    return NextResponse.json({ board, ranked });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke rangere liste" },
      { status: 500 }
    );
  }
}
