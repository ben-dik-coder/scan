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

function walkJsonLdNodes(
  value: unknown,
  visit: (node: Record<string, unknown>) => void,
  seen = new Set<unknown>()
) {
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) walkJsonLdNodes(item, visit, seen);
    return;
  }

  const node = value as Record<string, unknown>;
  visit(node);

  for (const key of ["@graph", "mainEntity", "hasPart", "subOrganization"]) {
    walkJsonLdNodes(node[key], visit, seen);
  }
}

function collectPhonesFromJsonLd(json: unknown): string[] {
  const found = new Set<string>();
  walkJsonLdNodes(json, (node) => {
    const tel = node.telephone ?? node.phone;
    if (typeof tel === "string") {
      const p = normalizePhone(tel);
      if (p) found.add(p);
    }
    const contactPoints = node.contactPoint;
    const points = Array.isArray(contactPoints)
      ? contactPoints
      : contactPoints
        ? [contactPoints]
        : [];
    for (const point of points) {
      if (!point || typeof point !== "object") continue;
      const row = point as Record<string, unknown>;
      const cpTel = row.telephone ?? row.phone;
      if (typeof cpTel === "string") {
        const p = normalizePhone(cpTel);
        if (p) found.add(p);
      }
    }
  });
  return [...found];
}

function collectEmailsFromJsonLd(json: unknown): string[] {
  const found = new Set<string>();
  walkJsonLdNodes(json, (node) => {
    const em = node.email;
    if (typeof em === "string") {
      const e = parseEmailFromText(em);
      if (e) found.add(e);
    }
    const contactPoints = node.contactPoint;
    const points = Array.isArray(contactPoints)
      ? contactPoints
      : contactPoints
        ? [contactPoints]
        : [];
    for (const point of points) {
      if (!point || typeof point !== "object") continue;
      const row = point as Record<string, unknown>;
      const cpEmail = row.email;
      if (typeof cpEmail === "string") {
        const e = parseEmailFromText(cpEmail);
        if (e) found.add(e);
      }
    }
  });
  return [...found];
}

export type ExtractPhonesOptions = {
  /** Fri regex på brødtekst — skru av for katalog/proff (bruk kun tel: og JSON-LD). */
  trustTextRegex?: boolean;
};

/** 1881 person-side — telefon i knapp og ofte i <title>. */
export function extract1881PersonPhonesFromHtml(html: string): string[] {
  const found = new Set<string>();
  const decoded = decodeHtmlEntities(html);

  for (const m of decoded.matchAll(
    /listing-main-buttons__phone-number[^>]*>\s*([^<]+)/gi
  )) {
    const p = normalizePhone(m[1] ?? "");
    if (p) found.add(p);
  }

  const title = decoded.match(/<title>([^<]+)/i)?.[1] ?? "";
  const titlePhone = title.match(/,\s*(\d{8})\s*,/);
  if (titlePhone) {
    const p = normalizePhone(titlePhone[1] ?? "");
    if (p) found.add(p);
  }

  return [...found];
}

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
      for (const phone of collectPhonesFromJsonLd(JSON.parse(block[1] ?? ""))) {
        found.add(phone);
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
      for (const email of collectEmailsFromJsonLd(JSON.parse(block[1] ?? ""))) {
        found.add(email);
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
