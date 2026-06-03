const BRREG_BASE = "https://data.brreg.no/enhetsregisteret/api";

export type BrregAddress = {
  kommunenummer?: string;
  kommune?: string;
  poststed?: string;
  postnummer?: string;
};

export type BrregEnhet = {
  organisasjonsnummer: string;
  navn: string;
  epostadresse?: string;
  telefon?: string;
  mobil?: string;
  hjemmeside?: string;
  registreringsdatoEnhetsregisteret?: string;
  naeringskode1?: { kode?: string; beskrivelse?: string };
  forretningsadresse?: BrregAddress;
  postadresse?: BrregAddress;
};

export type BrregSearchResponse = {
  _embedded?: { enheter?: BrregEnhet[] };
  page?: { totalElements?: number; totalPages?: number; number?: number; size?: number };
};

export type BrregUpdateEntry = {
  organisasjonsnummer: string;
  oppdateringsid?: number;
  endringstype?: string;
  dato?: string;
};

export type BrregUpdatesResponse = {
  _embedded?: { oppdateringer?: BrregUpdateEntry[]; oppdaterteEnheter?: BrregUpdateEntry[] };
  page?: { totalElements?: number; totalPages?: number; number?: number };
};

const BRREG_TIMEOUT_MS = 25_000;

async function brregFetch<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRREG_TIMEOUT_MS);

  try {
    const res = await fetch(`${BRREG_BASE}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Brreg API error ${res.status}: ${path}`);
    }

    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Brønnøysund svarte ikke i tide — prøv igjen");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchEnhet(orgnr: string): Promise<BrregEnhet | null> {
  try {
    return await brregFetch<BrregEnhet>(`/enheter/${orgnr}`);
  } catch {
    return null;
  }
}

export type SearchEnheterParams = {
  municipalityCode?: string;
  /** Flere kommuner (f.eks. hele Nordland) — kommaseparert til Brreg */
  municipalityCodes?: string[];
  /** NACE-koder, kommaseparert (f.eks. 96 eller 96.210,96.220) */
  naeringskode?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  size?: number;
};

export async function searchEnheter(
  params: SearchEnheterParams = {}
): Promise<BrregSearchResponse> {
  const query = new URLSearchParams();
  if (params.municipalityCodes?.length) {
    query.set(
      "forretningsadresse.kommunenummer",
      params.municipalityCodes.join(",")
    );
  } else if (params.municipalityCode) {
    query.set("forretningsadresse.kommunenummer", params.municipalityCode);
  }
  if (params.naeringskode) {
    query.set("naeringskode", params.naeringskode);
  }
  if (params.fromDate) {
    query.set("fraRegistreringsdatoEnhetsregisteret", params.fromDate);
  }
  if (params.toDate) {
    query.set("tilRegistreringsdatoEnhetsregisteret", params.toDate);
  }
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 100));

  return brregFetch<BrregSearchResponse>(`/enheter?${query.toString()}`);
}

export type FetchUpdatesParams = {
  page?: number;
  size?: number;
  /** ISO-8601 — oppdateringer fra og med dette tidspunktet */
  dato?: string;
  /** Kun oppdateringer fra og med denne id (Brreg anbefaler id+1 etter forrige kjøring) */
  oppdateringsid?: number;
  updatedBefore?: string;
};

export async function fetchUpdates(
  params: FetchUpdatesParams = {}
): Promise<BrregUpdatesResponse> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 100));
  if (params.dato) query.set("dato", params.dato);
  if (params.oppdateringsid != null) {
    query.set("oppdateringsid", String(params.oppdateringsid));
  }
  if (params.updatedBefore) query.set("updatedBefore", params.updatedBefore);

  return brregFetch<BrregUpdatesResponse>(
    `/oppdateringer/enheter?${query.toString()}`
  );
}

export type BrregKommune = {
  nummer: string;
  navn: string;
};

export async function fetchKommuner(): Promise<BrregKommune[]> {
  const all: BrregKommune[] = [];
  let page = 0;

  while (page < 20) {
    const data = await brregFetch<{
      _embedded?: { kommuner?: Array<{ nummer?: string; navn?: string }> };
      page?: { totalPages?: number };
    }>(`/kommuner?page=${page}&size=100`);

    const batch = (data._embedded?.kommuner ?? []).map((k) => ({
      nummer: k.nummer ?? "",
      navn: k.navn ?? "",
    }));
    if (batch.length === 0) break;
    all.push(...batch);

    const totalPages = data.page?.totalPages ?? 1;
    if (page >= totalPages - 1) break;
    page += 1;
  }

  return all;
}

export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatDateISO(d);
}
