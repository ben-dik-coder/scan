import { NextResponse } from "next/server";
import { fetchKommuner } from "@/lib/brreg/client";
import { isBrregLive } from "@/lib/demo/config";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export async function GET() {
  if (!isBrregLive()) {
    return NextResponse.json({ error: "Live Brreg er av" }, { status: 403 });
  }

  try {
    const kommuner = await fetchKommuner();
    return NextResponse.json({
      municipalities: kommuner
        .filter((k) => k.nummer && k.navn)
        .map((k) => ({ code: k.nummer, name: k.navn, count: 0 }))
        .sort((a, b) => a.name.localeCompare(b.name, "nb")),
    });
  } catch (err) {
    console.error("[api/kommuner]", err);
    return NextResponse.json(
      { error: "Kunne ikke hente kommuner fra Brønnøysund" },
      { status: 502 }
    );
  }
}
