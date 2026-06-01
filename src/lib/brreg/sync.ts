import {
  daysAgoISO,
  fetchEnhet,
  fetchUpdates,
  formatDateISO,
  searchEnheter,
  type BrregEnhet,
} from "./client";
import { mapBrregEnhet, type CompanyInsert } from "./map-company";
import { createServiceClient } from "@/lib/supabase/service";

export type SyncResult = {
  mode: "updates" | "bootstrap";
  processed: number;
  upserted: number;
  errors: number;
  lastSync: string;
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

async function updateSyncState(
  key: string,
  metadata: Record<string, unknown>
) {
  const supabase = createServiceClient();
  await supabase.from("sync_state").upsert(
    {
      key,
      last_sync: new Date().toISOString(),
      metadata,
    },
    { onConflict: "key" }
  );
}

async function processEnheter(enheter: BrregEnhet[]) {
  const mapped = enheter.map(mapBrregEnhet);
  return upsertCompanies(mapped);
}

export async function syncBrregUpdates(): Promise<SyncResult> {
  let page = 0;
  let processed = 0;
  let upserted = 0;
  let errors = 0;
  const orgnrs = new Set<string>();

  while (page < 50) {
    const data = await fetchUpdates(page);
    const updates =
      data._embedded?.oppdaterteEnheter ?? data._embedded?.oppdateringer ?? [];
    if (updates.length === 0) break;

    for (const update of updates) {
      orgnrs.add(update.organisasjonsnummer);
    }

    const totalPages = data.page?.totalPages ?? 1;
    if (page >= totalPages - 1) break;
    page += 1;
  }

  for (const orgnr of Array.from(orgnrs)) {
    processed += 1;
    try {
      const enhet = await fetchEnhet(orgnr);
      if (enhet) {
        upserted += await processEnheter([enhet]);
      }
    } catch {
      errors += 1;
    }
  }

  const lastSync = new Date().toISOString();
  await updateSyncState("brreg_enheter", {
    mode: "updates",
    processed,
    upserted,
    errors,
  });

  return { mode: "updates", processed, upserted, errors, lastSync };
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

export async function runBrregSync(options?: {
  bootstrap?: boolean;
  days?: number;
}): Promise<SyncResult> {
  if (options?.bootstrap) {
    return bootstrapBrreg(options.days ?? 90);
  }
  return syncBrregUpdates();
}
