/** Normaliser telefon til 8 siffer (uten +47). */
export function phoneCoreDigits(phone: string): string | null {
  let core = phone.replace(/\D/g, "");
  if (core.startsWith("0047") && core.length === 12) core = core.slice(4);
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

/** Åtte siffer som ser ut som dato (YYYYMMDD) — ofte feiltreff fra HTML. */
export function phoneLooksLikeDate(core: string): boolean {
  if (core.length !== 8) return false;
  const year = Number(core.slice(0, 4));
  const month = Number(core.slice(4, 6));
  const day = Number(core.slice(6, 8));
  if (year < 1990 || year > 2099) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
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

const PLACEHOLDER_PHONE_CORES = new Set([
  "00000000",
  "11111111",
  "12121212",
  "12345678",
  "22222222",
  "33333332",
  "33333333",
  "44444444",
  "55555555",
  "66666666",
  "77777777",
  "87654321",
  "88888888",
  "99999999",
]);

/** Åpenbart falske/placeholder-telefoner i registeret. */
export function isPlaceholderPhoneCore(core: string): boolean {
  if (core.length !== 8) return false;
  if (PLACEHOLDER_PHONE_CORES.has(core)) return true;
  if (/^(\d)\1{7}$/.test(core)) return true;
  if (core === "23456789" || core === "34567890") return true;
  return false;
}

/** Gyldig norsk telefonformat (uten org.nr-sjekk). */
export function isPlausibleNorwegianPhone(phone: string): boolean {
  const core = phoneCoreDigits(phone);
  if (!core) return false;
  if (isPlaceholderPhoneCore(core)) return false;
  return isValidNorwegianPhoneCore(core);
}

/** Telefon er gyldig norsk nummer og ikke org.nr-lignende. */
export function phonePlausibleForCompany(
  phone: string,
  orgnr: string
): boolean {
  const core = phoneCoreDigits(phone);
  if (!core) return false;
  if (!isValidNorwegianPhoneCore(core)) return false;
  if (isPlaceholderPhoneCore(core)) return false;
  if (phoneLooksLikeDate(core)) return false;
  const normalizedOrgnr = orgnr.replace(/\D/g, "");
  if (normalizedOrgnr.length === 9 && phoneLooksLikeOrgnr(core, normalizedOrgnr)) {
    return false;
  }
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

/** Trekk ut norsk telefon fra fritekst (søkesnippets, titler). */
export function extractPhoneFromText(text: string): string | null {
  const patterns = [
    /(?:\+47|0047)[\s.-]?(?:\d[\s.-]?){7}\d/g,
    /\b\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}\b/g,
    /\b\d{3}[\s.-]\d{2}[\s.-]\d{3}\b/g,
    /\b[49]\d{7}\b/g,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) {
      const digits = match[0].replace(/\D/g, "");
      if (digits.length >= 8) return match[0].trim();
    }
  }
  return null;
}
