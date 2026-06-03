import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("profiles").select("plan, subscription_status").limit(1);

    if (error) {
      const missing =
        error.message.includes("column") ||
        error.code === "42703" ||
        error.message.includes("does not exist");

      return NextResponse.json({
        ready: false,
        missingBillingColumns: missing,
        error: error.message,
        fix: "Kjør supabase/SETUP_BILLING.sql i Supabase SQL Editor",
        sqlEditorUrl:
          "https://supabase.com/dashboard/project/umsimryvoifrjmkaelup/sql/new",
      });
    }

    return NextResponse.json({ ready: true, missingBillingColumns: false });
  } catch (err) {
    return NextResponse.json(
      {
        ready: false,
        error: err instanceof Error ? err.message : "Ukjent feil",
      },
      { status: 500 }
    );
  }
}
