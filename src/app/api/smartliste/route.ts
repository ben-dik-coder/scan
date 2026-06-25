import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  createSmartList,
  listSmartLists,
} from "@/lib/smartliste/smart-list-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const lists = await listSmartLists(user.id);
    return NextResponse.json({ lists });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke hente lister" },
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
    const name = typeof body.name === "string" ? body.name : "";
    if (!name.trim()) {
      return NextResponse.json({ error: "Navn er påkrevd" }, { status: 400 });
    }

    const list = await createSmartList(user.id, name, {
      listKind: body.list_kind === "dynamic" ? "dynamic" : "static",
      filters: body.filters ?? {},
      boardConfig: body.board_config,
    });

    return NextResponse.json(list);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke opprette liste" },
      { status: 500 }
    );
  }
}
