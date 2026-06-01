import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: sequences, error } = await supabase
    .from("email_sequences")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withSteps = [];
  for (const seq of sequences ?? []) {
    const { data: steps } = await supabase
      .from("email_sequence_steps")
      .select("*")
      .eq("sequence_id", seq.id)
      .order("step_order", { ascending: true });
    withSteps.push({ ...seq, steps: steps ?? [] });
  }

  return NextResponse.json(withSteps);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, steps } = await request.json();
  if (!name?.trim() || !steps?.length) {
    return NextResponse.json(
      { error: "Navn og minst ett steg er påkrevd" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: seq, error } = await supabase
    .from("email_sequences")
    .insert({ user_id: user.id, name, active: true })
    .select()
    .single();

  if (error || !seq) {
    return NextResponse.json({ error: error?.message ?? "Feil" }, { status: 500 });
  }

  await supabase.from("email_sequence_steps").insert(
    steps.map(
      (
        s: { step_order: number; delay_days: number; subject: string; body: string },
        i: number
      ) => ({
        sequence_id: seq.id,
        step_order: s.step_order ?? i,
        delay_days: s.delay_days ?? 0,
        subject: s.subject,
        body: s.body,
      })
    )
  );

  return NextResponse.json(seq);
}
