import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Supabase sender brukeren hit etter e-postbekreftelse / magic link */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app/oversikt";
  const authError = searchParams.get("error_description") ?? searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(
      `${origin}/innlogging?error=${encodeURIComponent(authError)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/innlogging?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/innlogging?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : `/${next}`}`);
}
