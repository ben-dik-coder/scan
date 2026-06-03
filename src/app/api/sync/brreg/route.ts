import { NextResponse } from "next/server";
import { getSessionUser, getProfile } from "@/lib/auth";
import { runBrregSync } from "@/lib/brreg/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const headerSecret = request.headers.get("x-cron-secret");
  return headerSecret === cronSecret;
}

type SyncOptions = {
  bootstrap?: boolean;
  days?: number;
  kommune?: boolean;
  kommuneIndex?: number;
};

async function parseSyncOptions(request: Request): Promise<SyncOptions> {
  let bootstrap = false;
  let days = 90;
  let kommune = false;
  let kommuneIndex: number | undefined;

  try {
    const body = await request.json();
    bootstrap = Boolean(body?.bootstrap);
    kommune = Boolean(body?.kommune);
    if (typeof body?.days === "number") days = body.days;
    if (typeof body?.kommuneIndex === "number") kommuneIndex = body.kommuneIndex;
  } catch {
    // empty body ok (Vercel Cron sends GET without body)
  }

  return { bootstrap, days, kommune, kommuneIndex };
}

async function handleSync(request: Request) {
  const isCron = isAuthorizedCron(request);

  if (!isCron) {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const profile = await getProfile();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { bootstrap, days, kommune, kommuneIndex } = await parseSyncOptions(request);

  try {
    const result = await runBrregSync({ bootstrap, days, kommune, kommuneIndex });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel Cron kaller GET med Authorization: Bearer CRON_SECRET */
export async function GET(request: Request) {
  return handleSync(request);
}

/** Manuell/admin-trigger via POST */
export async function POST(request: Request) {
  return handleSync(request);
}
