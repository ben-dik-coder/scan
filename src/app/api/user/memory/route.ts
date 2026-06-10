import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { loadUserMemory } from "@/lib/agent/user-memory";

const CLIENT_KEYS = new Set(["default_municipality", "default_region"]);

export const dynamic = "force-dynamic";

/** Hent lagrede bruker-preferanser (f.eks. default_municipality for GPS-fallback). */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = new URL(request.url).searchParams.get("key");
  const entries = await loadUserMemory(user.id);

  if (key) {
    if (!CLIENT_KEYS.has(key)) {
      return NextResponse.json({ error: "Ugyldig nøkkel" }, { status: 400 });
    }
    const match = entries.find((e) => e.key === key);
    return NextResponse.json({
      key,
      value: match?.value ?? null,
    });
  }

  const prefs = Object.fromEntries(
    entries
      .filter((e) => CLIENT_KEYS.has(e.key))
      .map((e) => [e.key, e.value])
  );

  return NextResponse.json({ preferences: prefs });
}
