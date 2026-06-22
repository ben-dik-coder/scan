import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function serialize(row: {
  title: string;
  body_html: string;
  updated_at: string;
}) {
  return {
    title: row.title ?? "Manus",
    bodyHtml: row.body_html ?? "",
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_manus")
    .select("title, body_html, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      title: "Manus",
      bodyHtml: "",
      updatedAt: null,
    });
  }

  return NextResponse.json(serialize(data));
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : "Manus";
  const bodyHtml = typeof body.bodyHtml === "string" ? body.bodyHtml : "";

  if (bodyHtml.length > 200_000) {
    return NextResponse.json(
      { error: "Manuset er for langt (maks 200 000 tegn)." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_manus")
    .upsert(
      {
        user_id: user.id,
        title,
        body_html: bodyHtml,
      },
      { onConflict: "user_id" }
    )
    .select("title, body_html, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(serialize(data));
}
