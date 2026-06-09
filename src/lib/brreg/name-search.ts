export function normalizeCompanyNameForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeNameQueryForIlike(nameQuery: string): string | null {
  const trimmed = nameQuery.trim().replace(/[%_]/g, "");
  if (trimmed.length < 2) return null;
  return trimmed;
}

export function companyNameMatchesQuery(
  companyName: string,
  nameQuery?: string
): boolean {
  const trimmed = nameQuery?.trim() ?? "";
  if (trimmed.length < 2) return true;

  const sanitized = sanitizeNameQueryForIlike(trimmed);
  if (!sanitized) return true;

  const normalizedName = normalizeCompanyNameForSearch(companyName);
  const tokens = sanitized.split(/\s+/).filter(Boolean);
  return tokens.every((token) => {
    const normalizedToken = normalizeCompanyNameForSearch(token);
    return normalizedToken.length > 0 && normalizedName.includes(normalizedToken);
  });
}

export function nameQueryTokens(nameQuery?: string): string[] {
  const sanitized = sanitizeNameQueryForIlike(nameQuery?.trim() ?? "");
  if (!sanitized) return [];
  return sanitized.split(/\s+/).filter(Boolean);
}
