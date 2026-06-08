import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchCompaniesByOrgnrs } from "@/lib/brreg/fetch-companies-by-orgnr";
import { isBrregLive, isDemoMode } from "@/lib/demo/config";

export const dynamic = "force-dynamic";

function parseOrgnrs(value: string | null): string[] {
  if (!value?.trim()) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((orgnr) => orgnr.trim())
        .filter(Boolean)
    )
  );
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

  const orgnrs = parseOrgnrs(request.nextUrl.searchParams.get("orgnrs"));
  if (orgnrs.length === 0) {
    return NextResponse.json({ companies: [] });
  }

  try {
    const companies = await fetchCompaniesByOrgnrs(orgnrs, user?.id);
    return NextResponse.json({ companies });
  } catch (err) {
    console.error("[api/companies/by-orgnrs]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Kunne ikke hente firma for lagret liste",
      },
      { status: 502 }
    );
  }
}
