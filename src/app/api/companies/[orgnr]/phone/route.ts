import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { persistCompanyPhonePatch } from "@/lib/company-contact-overrides";
import {
  isValidNorwegianPhoneCore,
  phoneCoreDigits,
} from "@/lib/website-scan/phone-plausible";

function parseManualPhone(
  input: string
): Partial<{ phone: string; mobile: string }> | null {
  const core = phoneCoreDigits(input);
  if (!core || !isValidNorwegianPhoneCore(core)) return null;
  if (core.startsWith("9") || core.startsWith("4")) return { mobile: core };
  return { phone: core };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgnr: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgnr: rawOrgnr } = await params;
  const orgnr = rawOrgnr?.trim();
  if (!orgnr) {
    return NextResponse.json({ error: "orgnr mangler" }, { status: 400 });
  }

  const body = (await request.json()) as { phone?: unknown };
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!rawPhone) {
    return NextResponse.json({ error: "Telefonnummer mangler" }, { status: 400 });
  }

  const patch = parseManualPhone(rawPhone);
  if (!patch) {
    return NextResponse.json(
      { error: "Ugyldig norsk telefonnummer (8 siffer)" },
      { status: 400 }
    );
  }

  try {
    await persistCompanyPhonePatch(orgnr, patch);
    const display = patch.mobile ?? patch.phone ?? null;
    return NextResponse.json({ orgnr, phone: display, ...patch });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke lagre telefon";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
