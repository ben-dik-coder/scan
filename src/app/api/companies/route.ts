import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getEntitlements } from "@/lib/billing/entitlements";
import { applyCompanyContactLimit } from "@/lib/billing/usage";
import { fetchCompaniesFromBrreg } from "@/lib/brreg/fetch-companies";
import { isBrregLive, isDemoMode } from "@/lib/demo/config";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!isBrregLive()) {
    return NextResponse.json(
      { error: "Live Brreg er av. Sett NEXT_PUBLIC_BRREG_LIVE=true" },
      { status: 403 }
    );
  }

  const user = await getSessionUser();
  if (!user && !isDemoMode()) {
    return NextResponse.json({ error: "Du må være innlogget." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const regionId = searchParams.get("omrade") ?? "";
  const municipalityCode = searchParams.get("kommune") ?? undefined;
  const daysParam = searchParams.get("dager");
  const days =
    daysParam === "0" || daysParam === "alle"
      ? 0
      : Number.isFinite(Number(daysParam))
        ? Number(daysParam)
        : 30;
  const hasEmail = searchParams.get("epost") !== "0";
  const genericEmailOnly = searchParams.get("generisk") === "1";
  const industryGroup = searchParams.get("bransje") ?? "";

  try {
    const result = await fetchCompaniesFromBrreg({
      regionId: regionId || undefined,
      municipalityCode: municipalityCode || undefined,
      days,
      hasEmail,
      genericEmailOnly,
      industryGroup: industryGroup || undefined,
    });

    let companies = result.companies;
    let contactUsage:
      | {
          used: number;
          limit: number;
          remaining: number;
          limitReached: boolean;
          newlyAdded: number;
        }
      | undefined;

    if (user && !isDemoMode()) {
      const entitlements = await getEntitlements(user.id);
      if (!entitlements.hasAccess) {
        return NextResponse.json(
          { error: "Aktivt abonnement kreves. Gå til Abonnement." },
          { status: 403 }
        );
      }

      const limited = await applyCompanyContactLimit(
        user.id,
        companies,
        entitlements.maxCompaniesWithContactPerMonth
      );
      companies = limited.companies;
      contactUsage = limited.usage;
    }

    const withEmail = companies.filter((c) => c.has_email).length;

    return NextResponse.json({
      companies,
      total: companies.length,
      withEmail,
      brregTotal: result.brregTotal,
      truncated: result.truncated,
      source: "brreg",
      allTime: days === 0,
      fetchedAt: new Date().toISOString(),
      contactUsage,
    });
  } catch (err) {
    console.error("[api/companies]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Kunne ikke hente firma fra Brønnøysund",
      },
      { status: 502 }
    );
  }
}
