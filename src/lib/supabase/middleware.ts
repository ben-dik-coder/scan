import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isBillingFreeEmail } from "@/lib/billing/billing-free";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/billing/plans";

function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

function hasBillingAccess(
  profile: {
    role: string;
    plan: string | null;
    subscription_status: string | null;
  },
  email?: string | null
) {
  if (profile.role === "admin") return true;
  if (isBillingFreeEmail(email)) return true;
  if (isDemoMode()) return true;
  if (!profile.plan) return false;
  return (
    profile.subscription_status !== null &&
    ACTIVE_SUBSCRIPTION_STATUSES.includes(
      profile.subscription_status as (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number]
    )
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user && (pathname.startsWith("/app") || pathname.startsWith("/admin"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/innlogging";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/innlogging" || pathname === "/registrer")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, plan, subscription_status")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname =
      profile && hasBillingAccess(profile, user.email)
        ? "/app/oversikt"
        : "/app/abonnement";
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/app")) {
    const isAbonnement = pathname === "/app/abonnement";
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, plan, subscription_status")
      .eq("id", user.id)
      .single();

    if (profile && !isAbonnement && !hasBillingAccess(profile, user.email)) {
      const url = request.nextUrl.clone();
      url.pathname = "/app/abonnement";
      return NextResponse.redirect(url);
    }
  }

  if (user && pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
