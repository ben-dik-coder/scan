import { NextRequest, NextResponse } from "next/server";
import { fetchCompaniesFromBrreg } from "@/lib/brreg/fetch-companies";
import { isBrregLive } from "@/lib/demo/config";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!isBrregLive()) {
    return NextResponse.json(
      { error: "Live Brreg er av. Sett NEXT_PUBLIC_BRREG_LIVE=true" },
      { status: 403 }
    );
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

    return NextResponse.json({
      ...result,
      source: "brreg",
      allTime: days === 0,
      fetchedAt: new Date().toISOString(),
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
