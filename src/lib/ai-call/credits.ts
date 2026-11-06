/**
 * Sjekk at ElevenLabs har nok kreditter før vi ringer.
 * Ellers ringer telefonen, men samtalen dør med en gang du svarer.
 */

const MIN_REMAINING_CHARS = 200;

export const ELEVENLABS_QUOTA_MESSAGE =
  "ElevenLabs er tom for credits. Fyll på / oppgrader planen der, ellers ringer telefonen men AI legger på når du svarer.";

export function looksLikeQuotaError(message: string): boolean {
  return /quota_exceeded|out of credits|run out of credits|insufficient.?credit|character.?limit/i.test(
    message
  );
}

export async function assertElevenLabsCanStartCall(
  apiKey: string
): Promise<void> {
  const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    // Ikke blokker hard hvis status-API feiler — outbound vil feile tydelig nok.
    return;
  }

  const sub = (await res.json().catch(() => null)) as {
    character_count?: number;
    character_limit?: number;
    tier?: string;
  } | null;

  if (!sub) return;

  const used = Number(sub.character_count ?? 0);
  const limit = Number(sub.character_limit ?? 0);
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return;

  const remaining = limit - used;
  if (remaining < MIN_REMAINING_CHARS) {
    throw new Error(
      `${ELEVENLABS_QUOTA_MESSAGE} (ca. ${Math.max(0, remaining)} tegn igjen på ${sub.tier ?? "planen"}).`
    );
  }
}

export function humanizeAiCallStartError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (looksLikeQuotaError(raw)) return ELEVENLABS_QUOTA_MESSAGE;
  return raw || "Kunne ikke starte AI-ring";
}
