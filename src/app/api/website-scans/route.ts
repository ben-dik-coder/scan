import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  isWebsiteScanResult,
  loadCachedWebsiteScans,
  parseOrgnrs,
  persistCachedWebsiteScans,
} from "@/lib/website-scan/saved-scans-server";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgnrs = parseOrgnrs(new URL(request.url).searchParams.get("orgnrs"));
  const scans = await loadCachedWebsiteScans(orgnrs);

  return NextResponse.json({ scans });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { scans?: unknown };
  const rawScans = Array.isArray(body.scans) ? body.scans : [];
  const scans = rawScans.filter(isWebsiteScanResult);

  if (scans.length === 0) {
    return NextResponse.json({ error: "Ingen gyldige skann" }, { status: 400 });
  }

  const { error, saved } = await persistCachedWebsiteScans(scans, user.id);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved });
}
