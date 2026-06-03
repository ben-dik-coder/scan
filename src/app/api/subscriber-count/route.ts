import { NextResponse } from "next/server";
import { getSubscriberCount } from "@/lib/billing/subscriber-cap";

export async function GET() {
  try {
    const data = await getSubscriberCount();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    console.error("[subscriber-count]", err);
    return NextResponse.json(
      { error: "Kunne ikke hente antall abonnenter." },
      { status: 500 }
    );
  }
}
