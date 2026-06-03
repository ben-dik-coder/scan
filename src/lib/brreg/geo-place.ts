/** Små ord i norske stedsnavn som skal være lowercase (Mo i Rana). */
const LOWER_PARTS = new Set(["i", "og", "på", "av", "ved", "til", "for"]);

/**
 * Gjør Brreg-stedsnavn (ofte STORE BOKSTAVER) om til lesbart format for Google/FB-søk.
 * Eksempel: "MO I RANA" → "Mo i Rana", "BODØ" → "Bodø"
 */
export function formatNorwegianPlace(
  name: string | null | undefined
): string | null {
  if (!name?.trim()) return null;

  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && LOWER_PARTS.has(word)) return word;
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Steder å bruke i nettside-/sosial-søk.
 * Poststed (by) er ofte mer presist enn kommune (f.eks. Tverlandet vs Bodø).
 */
export function companyGeoPlaces(input: {
  municipality_name?: string | null;
  city?: string | null;
}): string[] {
  const municipality = formatNorwegianPlace(input.municipality_name);
  const city = formatNorwegianPlace(input.city);
  const places: string[] = [];
  const seen = new Set<string>();

  const add = (place: string | null) => {
    if (!place) return;
    const key = place.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    places.push(place);
  };

  add(city);
  if (municipality && municipality.toLowerCase() !== city?.toLowerCase()) {
    add(municipality);
  } else if (!city) {
    add(municipality);
  }

  return places;
}

/** Primær geo-streng for scoring (by først, ellers kommune). */
export function primaryGeoPlace(input: {
  municipality_name?: string | null;
  city?: string | null;
}): string | null {
  return companyGeoPlaces(input)[0] ?? null;
}
