import { type NextRequest, NextResponse } from "next/server";

function supabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key && url.startsWith("http"));
}

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/app") || pathname.startsWith("/admin");
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!supabaseConfigured()) {
    if (isProtectedPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/innlogging";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  try {
    const { updateSession } = await import("@/lib/supabase/middleware");
    return await updateSession(request);
  } catch (err) {
    console.error("[middleware] Supabase session failed:", err);
    if (isProtectedPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/innlogging";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|css)$).*)",
  ],
};
