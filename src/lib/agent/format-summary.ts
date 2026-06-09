/** Korte firmanavn-eksempler til tool-sammendrag og agent-svar. */
export function formatCompanyExamples(
  names: string[],
  max = 3
): string {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return "";
  const shown = trimmed.slice(0, max);
  const suffix = trimmed.length > max ? " …" : "";
  return ` — f.eks. ${shown.join(", ")}${suffix}`;
}

export function formatCountLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}
