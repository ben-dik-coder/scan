import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  agentOrgnrsFromFilters,
  mergeOrgnrsIntoFilters,
} from "@/lib/agent/saved-list-filters";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("saved_lists")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "Listen finnes ikke" }, { status: 404 });
  }

  const filters = { ...((current.filters as Record<string, unknown> | null) ?? {}) };
  const addOrgnrs = Array.isArray(body.addOrgnrs)
    ? (body.addOrgnrs as string[]).filter((o) => typeof o === "string" && o.trim())
    : [];
  const removeOrgnrs = Array.isArray(body.removeOrgnrs)
    ? new Set(
        (body.removeOrgnrs as string[]).filter((o) => typeof o === "string" && o.trim())
      )
    : null;

  if (addOrgnrs.length > 0) {
    Object.assign(filters, mergeOrgnrsIntoFilters(filters, addOrgnrs, "user"));
  }

  if (removeOrgnrs && removeOrgnrs.size > 0) {
    filters.agentOrgnrs = agentOrgnrsFromFilters(filters).filter((o) => !removeOrgnrs.has(o));
  }

  if (typeof body.group === "string") {
    const trimmed = body.group.trim();
    if (trimmed) filters.group = trimmed;
    else delete filters.group;
  }

  const updates: Record<string, unknown> = { filters };
  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }

  const { data, error } = await supabase
    .from("saved_lists")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_lists")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
