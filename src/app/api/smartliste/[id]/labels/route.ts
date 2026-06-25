import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createSmartListLabel } from "@/lib/smartliste/smart-list-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await params;

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name : "";
    const color = typeof body.color === "string" ? body.color : "sky";
    if (!name.trim()) {
      return NextResponse.json({ error: "Navn er påkrevd" }, { status: 400 });
    }

    const label = await createSmartListLabel(
      user.id,
      name,
      color,
      typeof body.group_name === "string" ? body.group_name : undefined
    );
    return NextResponse.json(label);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke opprette merkelapp" },
      { status: 500 }
    );
  }
}
