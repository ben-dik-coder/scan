type LeadSearchFields = {
  name: string;
  municipality_name?: string | null;
};

/** Søkestreng for manuelt Google-oppslag av ett lead (firmanavn + sted). */
export function buildLeadGoogleSearchQuery(company: LeadSearchFields): string {
  return [company.name, company.municipality_name].filter(Boolean).join(" ").trim();
}

export function buildGoogleSearchUrl(query: string, embed = true): string {
  const q = query.trim() || "nye firma Norge";
  const base = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  return embed ? `${base}&igu=1` : base;
}
