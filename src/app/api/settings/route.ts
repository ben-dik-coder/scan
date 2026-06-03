import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    webhookUrl: data?.webhook_url ?? "",
    weeklyAlertEnabled: data?.weekly_alert_enabled ?? false,
    weeklyAlertFilters: data?.weekly_alert_filters ?? {},
    weeklyAlertLastSentAt: data?.weekly_alert_last_sent_at ?? null,
  });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const webhookUrl =
    typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : undefined;
  const weeklyAlertEnabled =
    typeof body.weeklyAlertEnabled === "boolean"
      ? body.weeklyAlertEnabled
      : undefined;
  const weeklyAlertFilters =
    body.weeklyAlertFilters && typeof body.weeklyAlertFilters === "object"
      ? body.weeklyAlertFilters
      : undefined;

  if (webhookUrl && !/^https?:\/\/.+/i.test(webhookUrl)) {
    return NextResponse.json(
      { error: "Webhook-URL må starte med http:// eller https://" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const patch: Record<string, unknown> = { user_id: user.id };
  if (webhookUrl !== undefined) patch.webhook_url = webhookUrl || null;
  if (weeklyAlertEnabled !== undefined) {
    patch.weekly_alert_enabled = weeklyAlertEnabled;
  }
  if (weeklyAlertFilters !== undefined) {
    patch.weekly_alert_filters = weeklyAlertFilters;
  }

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(patch, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    webhookUrl: data.webhook_url ?? "",
    weeklyAlertEnabled: data.weekly_alert_enabled,
    weeklyAlertFilters: data.weekly_alert_filters,
  });
}
