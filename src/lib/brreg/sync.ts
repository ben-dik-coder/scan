import {
  daysAgoISO,
  fetchEnhet,
  fetchKommuner,
  fetchUpdates,
  formatDateISO,
  searchEnheter,
  type BrregEnhet,
} from "./client";
import { mapBrregEnhet, type CompanyInsert } from "./map-company";
import { enrichWithDagligLeder } from "./roles";
import { createServiceClient } from "@/lib/supabase/service";

export type SyncResult = {
  mode: "updates" | "bootstrap";
  processed: number;
  upserted: number;
  errors: number;
  lastSync: string;
  since?: string;
};

async function upsertCompanies(companies: CompanyInsert[]) {
  if (companies.length === 0) return 0;

  const supabase = createServiceClient();
  const { error } = await supabase.from("companies").upsert(companies, {
    onConflict: "orgnr",
  });

  if (error) throw new Error(error.message);
  return companies.length;
}

async function getSyncState(key: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sync_state")
    .select("last_sync, cursor, metadata")
    .eq("key", key)
    .maybeSingle();
  return data;
}

async function updateSyncState(
  key: string,
  metadata: Record<string, unknown>,
  options?: { cursor?: string }
) {
  const supabase = createServiceClient();
  await supabase.from("sync_state").upsert(
    {
      key,
      last_sync: new Date().toISOString(),
      cursor: options?.cursor ?? null,
      metadata,
    },
    { onConflict: "key" }
  );
}

async function processEnheter(enheter: BrregEnhet[]) {
  const mapped = enheter.map(mapBrregEnhet);
  return upsertCompanies(mapped);
}

function formatBrregDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

export async function syncBrregUpdates(): Promise<SyncResult> {
  const state = await getSyncState("brreg_enheter");
  const since = state?.last_sync
    ? formatBrregDateTime(new Date(state.last_sync))
    : formatBrregDateTime(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  const cursorId = state?.cursor ? Number.parseInt(state.cursor, 10) : undefined;
  const oppdateringsid =
    cursorId != null && Number.isFinite(cursorId) ? cursorId + 1 : undefined;

  let page = 0;
  let processed = 0;
  let upserted = 0;
  let errors = 0;
  let maxOppdateringsid: number | undefined;
  const orgnrs = new Set<string>();

  while (page < 100) {
    const data = await fetchUpdates({
      page,
      dato: since,
      oppdateringsid,
    });
    const updates =
      data._embedded?.oppdaterteEnheter ?? data._embedded?.oppdateringer ?? [];
    if (updates.length === 0) break;

    for (const update of updates) {
      orgnrs.add(update.organisasjonsnummer);
      if (update.oppdateringsid != null) {
        maxOppdateringsid = Math.max(
          maxOppdateringsid ?? 0,
          update.oppdateringsid
        );
      }
    }

    const totalPages = data.page?.totalPages ?? 1;
    if (page >= totalPages - 1) break;
    page += 1;
  }

  const supabase = createServiceClient();
  for (const orgnr of Array.from(orgnrs)) {
    processed += 1;
    try {
      const enhet = await fetchEnhet(orgnr);
      if (!enhet) continue;

      let mapped = mapBrregEnhet(enhet);
      if (mapped.has_email) {
        const { data: existing } = await supabase
          .from("companies")
          .select("daglig_leder")
          .eq("orgnr", orgnr)
          .maybeSingle();
        mapped = await enrichWithDagligLeder(
          mapped,
          existing?.daglig_leder ?? null
        );
      }
      upserted += await upsertCompanies([mapped]);
    } catch {
      errors += 1;
    }
  }

  const lastSync = new Date().toISOString();
  await updateSyncState(
    "brreg_enheter",
    {
      mode: "updates",
      since,
      processed,
      upserted,
      errors,
      maxOppdateringsid,
    },
    {
      cursor:
        maxOppdateringsid != null ? String(maxOppdateringsid) : state?.cursor,
    }
  );

  return { mode: "updates", processed, upserted, errors, lastSync, since };
}

export async function bootstrapBrreg(days = 90): Promise<SyncResult> {
  const fromDate = daysAgoISO(days);
  const toDate = formatDateISO(new Date());
  let page = 0;
  let processed = 0;
  let upserted = 0;
  let errors = 0;

  while (page < 100) {
    let data;
    try {
      data = await searchEnheter({ fromDate, toDate, page, size: 100 });
    } catch {
      errors += 1;
      break;
    }

    const enheter = data._embedded?.enheter ?? [];
    if (enheter.length === 0) break;

    processed += enheter.length;
    try {
      upserted += await processEnheter(enheter);
    } catch {
      errors += enheter.length;
    }

    const totalPages = data.page?.totalPages ?? 1;
    if (page >= totalPages - 1) break;
    page += 1;
  }

  const lastSync = new Date().toISOString();
  await updateSyncState("brreg_enheter", {
    mode: "bootstrap",
    days,
    processed,
    upserted,
    errors,
  });

  return { mode: "bootstrap", processed, upserted, errors, lastSync };
}

export type KommuneSyncResult = SyncResult & {
  kommuneCode?: string;
  kommuneIndex?: number;
  kommuneTotal?: number;
};

/**
 * Henter alle enheter for én kommune (omgår 10k-grensen på landsdekkende søk).
 * Kjør flere ganger med økende kommuneIndex via cron (én kommune per kall).
 */
export async function syncBrregKommune(options?: {
  kommuneIndex?: number;
  maxPagesPerKommune?: number;
}): Promise<KommuneSyncResult> {
  const kommuner = await fetchKommuner();
  const codes = kommuner.map((k) => k.nummer).filter(Boolean);
  const index = Math.max(0, options?.kommuneIndex ?? 0);
  const maxPages = options?.maxPagesPerKommune ?? 100;

  if (index >= codes.length) {
    const lastSync = new Date().toISOString();
    await updateSyncState("brreg_enheter", {
      mode: "kommune",
      kommuneIndex: index,
      kommuneTotal: codes.length,
      done: true,
    });
    return {
      mode: "bootstrap",
      processed: 0,
      upserted: 0,
      errors: 0,
      lastSync,
      kommuneIndex: index,
      kommuneTotal: codes.length,
    };
  }

  const kommuneCode = codes[index]!;
  let page = 0;
  let processed = 0;
  let upserted = 0;
  let errors = 0;

  while (page < maxPages) {
    let data;
    try {
      data = await searchEnheter({ municipalityCode: kommuneCode, page, size: 100 });
    } catch {
      errors += 1;
      break;
    }

    const enheter = data._embedded?.enheter ?? [];
    if (enheter.length === 0) break;

    processed += enheter.length;
    try {
      upserted += await processEnheter(enheter);
    } catch {
      errors += enheter.length;
    }

    const totalPages = data.page?.totalPages ?? 1;
    if (page >= totalPages - 1) break;
    page += 1;
  }

  const lastSync = new Date().toISOString();
  await updateSyncState("brreg_enheter", {
    mode: "kommune",
    kommuneCode,
    kommuneIndex: index,
    kommuneTotal: codes.length,
    processed,
    upserted,
    errors,
  });

  return {
    mode: "bootstrap",
    processed,
    upserted,
    errors,
    lastSync,
    kommuneCode,
    kommuneIndex: index,
    kommuneTotal: codes.length,
  };
}

export async function runBrregSync(options?: {
  bootstrap?: boolean;
  days?: number;
  kommune?: boolean;
  kommuneIndex?: number;
}): Promise<SyncResult | KommuneSyncResult> {
  if (options?.kommune) {
    return syncBrregKommune({ kommuneIndex: options.kommuneIndex });
  }
  if (options?.bootstrap) {
    return bootstrapBrreg(options.days ?? 90);
  }
  return syncBrregUpdates();
}
