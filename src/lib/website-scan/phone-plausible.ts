/** Normaliser telefon til 8 siffer (uten +47). */
export function phoneCoreDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  let core = digits;
  if (core.startsWith("47") && core.length === 10) core = core.slice(2);
  if (core.length !== 8) return null;
  return core;
}

/** Norske mobil/fasttelefon — første siffer 2–7 eller 9. */
export function isValidNorwegianPhoneCore(core: string): boolean {
  if (core.length !== 8) return false;
  const first = core[0]!;
  return first >= "2" && first <= "7" || first === "9";
}

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff += 1;
  }
  return diff;
}

/** Telefon som ligner organisasjonsnummer (9 siffer). */
export function phoneLooksLikeOrgnr(core: string, orgnr: string): boolean {
  const o = orgnr.replace(/\D/g, "");
  if (core.length !== 8 || o.length !== 9) return false;

  if (core === o.slice(0, 8)) return true;
  if (core === o.slice(1, 9)) return true;

  for (let i = 0; i <= o.length - 8; i++) {
    const window = o.slice(i, i + 8);
    if (window === core) return true;
    if (hammingDistance(window, core) <= 1) return true;
  }

  return false;
}

/** Telefon er gyldig norsk nummer og ikke org.nr-lignende. */
export function phonePlausibleForCompany(
  phone: string,
  orgnr: string
): boolean {
  const core = phoneCoreDigits(phone);
  if (!core) return false;
  if (!isValidNorwegianPhoneCore(core)) return false;
  if (phoneLooksLikeOrgnr(core, orgnr)) return false;
  return true;
}

/** Velg første plausible telefon fra kandidatliste. */
export function pickPlausiblePhone(
  candidates: string[],
  orgnr: string
): string | null {
  for (const candidate of candidates) {
    if (phonePlausibleForCompany(candidate, orgnr)) {
      const core = phoneCoreDigits(candidate)!;
      return core.replace(/(\d{3})(\d{2})(\d{3})/, "$1 $2 $3");
    }
  }
  return null;
}
