import { type NextRequest, NextResponse } from "next/server";

function supabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key && url.startsWith("http"));
}

export async function middleware(request: NextRequest) {
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  if (demo || !supabaseConfigured()) {
    return NextResponse.next();
  }

  try {
    const { updateSession } = await import("@/lib/supabase/middleware");
    return await updateSession(request);
  } catch (err) {
    console.error("[middleware] Supabase session failed:", err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|css)$).*)",
  ],
};
