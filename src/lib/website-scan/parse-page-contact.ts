import { isValidNorwegianPhoneCore, phoneCoreDigits } from "./phone-plausible";
import { parseEmailFromText } from "./resolve-company-email";

const EMAIL_IN_TEXT =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Norske mobil/fasttelefon (8 siffer, valgfritt +47). */
const NO_PHONE =
  /(?:\+47|0047)?[\s.-]*(\d[\s.-]?){8}/g;

const SKIP_PHONE_PREFIXES = new Set([
  "00000000",
  "12345678",
  "11111111",
  "99999999",
]);

/** Fjern org.nr-blokker før fri tekst-regex (unngår org.nr som telefon). */
const ORGNR_BLOCK =
  /(?:org\.?\s*nr|organisasjonsnummer)\s*[:.]?\s*(?:\d[\s.-]?){9}/gi;

function normalizePhone(raw: string): string | null {
  const core = phoneCoreDigits(raw);
  if (!core) return null;
  if (SKIP_PHONE_PREFIXES.has(core)) return null;
  if (/^(\d)\1{7}$/.test(core)) return null;
  if (!isValidNorwegianPhoneCore(core)) return null;
  return core.replace(/(\d{3})(\d{2})(\d{3})/, "$1 $2 $3");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function stripOrgnrBlocks(text: string): string {
  return text.replace(ORGNR_BLOCK, " ");
}

export type ExtractPhonesOptions = {
  /** Fri regex på brødtekst — skru av for katalog/proff (bruk kun tel: og JSON-LD). */
  trustTextRegex?: boolean;
};

export function extractPhonesFromHtml(
  html: string,
  options?: ExtractPhonesOptions
): string[] {
  const trustTextRegex = options?.trustTextRegex !== false;
  const found = new Set<string>();
  const decoded = decodeHtmlEntities(html);

  for (const m of decoded.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    const p = normalizePhone(m[1] ?? "");
    if (p) found.add(p);
  }

  for (const block of decoded.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const json = JSON.parse(block[1] ?? "") as Record<string, unknown>;
      const tel = json.telephone ?? json.phone;
      if (typeof tel === "string") {
        const p = normalizePhone(tel);
        if (p) found.add(p);
      }
    } catch {
      /* ignore */
    }
  }

  if (trustTextRegex) {
    const stripped = stripOrgnrBlocks(decoded);
    for (const m of stripped.matchAll(NO_PHONE)) {
      const p = normalizePhone(m[0] ?? "");
      if (p) found.add(p);
    }
  }

  return [...found];
}

export function extractEmailsFromHtml(html: string): string[] {
  const found = new Set<string>();
  const decoded = decodeHtmlEntities(html);

  for (const m of decoded.matchAll(/href=["']mailto:([^"']+)["']/gi)) {
    const email = parseEmailFromText(m[1] ?? "");
    if (email) found.add(email);
  }

  for (const m of decoded.matchAll(EMAIL_IN_TEXT)) {
    const email = parseEmailFromText(m[0] ?? "");
    if (email && !email.endsWith(".png") && !email.endsWith(".jpg")) {
      found.add(email);
    }
  }

  for (const block of decoded.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const json = JSON.parse(block[1] ?? "") as Record<string, unknown>;
      const em = json.email;
      if (typeof em === "string") {
        const e = parseEmailFromText(em);
        if (e) found.add(e);
      }
    } catch {
      /* ignore */
    }
  }

  return [...found];
}

/** Finn lenke til egen nettside på booking/katalog-sider. */
export function extractExternalWebsiteFromHtml(
  html: string,
  platformHost: string
): string | null {
  const decoded = decodeHtmlEntities(html);
  const hosts = new Set([
    platformHost.toLowerCase(),
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "google.com",
    "google.no",
  ]);

  for (const m of decoded.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    try {
      const u = new URL(m[0]!);
      const host = u.hostname.replace(/^www\./i, "").toLowerCase();
      if (hosts.has(host)) continue;
      if (host.endsWith(".timma.no") || host.endsWith(".fixit.no")) continue;
      if (/\.(png|jpg|gif|svg|css|js)$/i.test(u.pathname)) continue;
      return u.toString();
    } catch {
      continue;
    }
  }
  return null;
}
