import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getEntitlements, requireFeature } from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, subject, body, is_default } = await request.json();
  if (!name?.trim() || !subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Alle felt er påkrevd" }, { status: 400 });
  }

  const supabase = await createClient();
  const entitlements = await getEntitlements(user.id);
  const emailError = requireFeature(entitlements, "email");
  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 403 });
  }

  if (entitlements.maxTemplates !== null) {
    const { count } = await supabase
      .from("email_templates")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= entitlements.maxTemplates) {
      return NextResponse.json(
        {
          error: `Start-pakken tillater maks ${entitlements.maxTemplates} maler. Oppgrader til Pro.`,
        },
        { status: 403 }
      );
    }
  }

  if (is_default) {
    await supabase
      .from("email_templates")
      .update({ is_default: false })
      .eq("user_id", user.id);
  }

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      user_id: user.id,
      name,
      subject,
      body,
      is_default: Boolean(is_default),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
