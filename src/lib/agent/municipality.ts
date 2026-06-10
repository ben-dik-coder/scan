/** Kommunenavn → Brønnøysund-kode (kun vanlige steder i målmarkedet). */
const MUNICIPALITY_ALIASES: Record<string, string> = {
  oslo: "0301",
  bergen: "4601",
  trondheim: "5001",
  stavanger: "1103",
  bodø: "1804",
  bodo: "1804",
  narvik: "1806",
  tromsø: "5501",
  tromso: "5501",
  harstad: "5503",
  "mo i rana": "1833",
  "mo-i-rana": "1833",
  rana: "1833",
  leknes: "1860",
  vestvagoy: "1860",
  vestvågøy: "1860",
  sortland: "1870",
  melbu: "1866",
  svolvær: "1865",
  svolvaer: "1865",
  alta: "5601",
  hammerfest: "5603",
  kirkenes: "5605",
  fauske: "1841",
  mosjøen: "1824",
  mosjoen: "1824",
  sandnessjøen: "1820",
  sandnessjoen: "1820",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseMunicipalityFromMessage(
  message: string
): { code?: string; label?: string } {
  const normalized = message.trim().toLowerCase();

  for (const [alias, code] of Object.entries(MUNICIPALITY_ALIASES)) {
    const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
    if (pattern.test(normalized)) {
      return { code, label: alias };
    }
  }

  return {};
}

export function municipalityCodeForName(name: string): string | undefined {
  const key = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae");
  return MUNICIPALITY_ALIASES[key];
}
