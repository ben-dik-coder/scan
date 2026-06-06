import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getEntitlements } from "@/lib/billing/entitlements";
import { applyCompanyContactLimit } from "@/lib/billing/usage";
import { shouldUseBrregDb } from "@/lib/brreg/db-source";
import { fetchCompaniesFromDb } from "@/lib/brreg/fetch-companies-db";
import {
  fetchCompaniesFromBrreg,
  parsePaginationParams,
} from "@/lib/brreg/fetch-companies";
import { isBrregLive, isDemoMode } from "@/lib/demo/config";
import { parseProfessionIdFromParam } from "@/lib/constants/professions";
import { buildMarketShuffleSeed } from "@/lib/shuffle/seeded-shuffle";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function parsePageParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
}

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
  const professionId = parseProfessionIdFromParam(searchParams.get("yrke") ?? "");
  const { page, pageSize } = parsePaginationParams(
    parsePageParam(searchParams.get("page")),
    parsePageParam(searchParams.get("pageSize"))
  );

  const filterKey = {
    regionId: regionId || undefined,
    municipalityCode,
    days,
    hasEmail,
    genericEmailOnly,
    industryGroup: industryGroup || undefined,
    professionId: professionId || undefined,
  };

  try {
    const shuffleSeed =
      user && !isDemoMode()
        ? buildMarketShuffleSeed(user.id, filterKey)
        : undefined;

    const useDb = await shouldUseBrregDb();
    const result = useDb
      ? await fetchCompaniesFromDb({
          ...filterKey,
          page,
          pageSize,
          sortSeed: shuffleSeed,
        })
      : await fetchCompaniesFromBrreg({
          ...filterKey,
          page,
          pageSize,
          sortSeed: shuffleSeed,
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
        entitlements.maxCompaniesWithContactPerMonth,
        shuffleSeed,
        { preserveOrder: true }
      );
      companies = limited.companies;
      contactUsage = limited.usage;
    }

    const withEmail = companies.filter((c) => c.has_email).length;

    return NextResponse.json({
      companies,
      total: result.total,
      withEmail,
      brregTotal: result.brregTotal,
      truncated: result.truncated,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
      source: useDb ? "db" : "brreg",
      allTime: days === 0,
      dbCompanyCount: useDb && "dbCompanyCount" in result ? result.dbCompanyCount : undefined,
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
