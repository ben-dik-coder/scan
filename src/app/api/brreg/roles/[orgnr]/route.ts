import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchDagligLeder } from "@/lib/brreg/roles";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: Request,
  { params }: { params: { orgnr: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgnr = params.orgnr?.trim();
  if (!orgnr) {
    return NextResponse.json({ error: "Mangler orgnr" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("daglig_leder")
    .eq("orgnr", orgnr)
    .maybeSingle();

  if (company?.daglig_leder) {
    return NextResponse.json({ dagligLeder: company.daglig_leder });
  }

  const name = await fetchDagligLeder(orgnr);
  if (name) {
    await createServiceClient()
      .from("companies")
      .update({ daglig_leder: name })
      .eq("orgnr", orgnr);
  }

  return NextResponse.json({ dagligLeder: name });
}
