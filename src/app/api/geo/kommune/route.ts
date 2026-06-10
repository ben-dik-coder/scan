import { NextResponse } from "next/server";
import { kommuneFromCoords } from "@/lib/geo/kommune-from-coords";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Ugyldige koordinater — oppgi lat og lng." },
      { status: 400 }
    );
  }

  const kommune = await kommuneFromCoords(lat, lng);
  if (!kommune) {
    return NextResponse.json(
      { error: "Fant ingen norsk kommune for posisjonen." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    kommunenummer: kommune.municipalityCode,
    kommunenavn: kommune.municipalityName,
    fylkesnavn: kommune.countyName ?? null,
    regionId: kommune.regionId,
  });
}
