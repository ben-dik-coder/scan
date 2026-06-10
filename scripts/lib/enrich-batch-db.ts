import type { BrregEnhet } from "../../src/lib/brreg/client.ts";
import { mapBrregEnhet } from "../../src/lib/brreg/map-company.ts";
import { preserveExistingContactFields } from "../../src/lib/brreg/upsert-enhet.ts";
import { createServiceClient } from "../../src/lib/supabase/service.ts";
import type { WebsiteScanResult } from "../../src/lib/website-scan/types.ts";
import type { Company } from "../../src/types/database.ts";

export const ENRICH_BATCH_SIZE = 50;
const SELECT_CHUNK = 80;

type CompanyRow = Record<string, unknown> & { orgnr: string };

export class CompanyPatchBuffer {
  private patches = new Map<string, CompanyRow>();
  private readonly batchSize: number;
  private op = Promise.resolve();

  constructor(batchSize = ENRICH_BATCH_SIZE) {
    this.batchSize = batchSize;
  }

  queue(orgnr: string, patch: Record<string, unknown>): Promise<void> {
    return this.run(async () => {
      const prev = this.patches.get(orgnr);
      this.patches.set(orgnr, {
        ...(prev ?? { orgnr }),
        ...patch,
        orgnr,
      });
      if (this.patches.size >= this.batchSize) {
        await this.flushUnlocked();
      }
    });
  }

  flush(): Promise<void> {
    return this.run(() => this.flushUnlocked());
  }

  private async flushUnlocked(): Promise<void> {
    if (this.patches.size === 0) return;
    const rows = [...this.patches.values()];
    this.patches.clear();
    const supabase = createServiceClient();
    for (let i = 0; i < rows.length; i += this.batchSize) {
      const chunk = rows.slice(i, i + this.batchSize);
      const { error } = await supabase
        .from("companies")
        .upsert(chunk, { onConflict: "orgnr" });
      if (error) throw new Error(`Company batch upsert: ${error.message}`);
    }
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.op.then(fn);
    this.op = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }
}

export type WebsiteScanRow = {
  orgnr: string;
  scan: WebsiteScanResult;
  scanned_at: string;
  scanned_by: string;
};

export class WebsiteScanBuffer {
  private rows = new Map<string, WebsiteScanRow>();
  private readonly batchSize: number;
  private op = Promise.resolve();

  constructor(batchSize = ENRICH_BATCH_SIZE) {
    this.batchSize = batchSize;
  }

  queue(row: WebsiteScanRow): Promise<void> {
    return this.run(async () => {
      this.rows.set(row.orgnr, row);
      if (this.rows.size >= this.batchSize) {
        await this.flushUnlocked();
      }
    });
  }

  flush(): Promise<void> {
    return this.run(() => this.flushUnlocked());
  }

  private async flushUnlocked(): Promise<void> {
    if (this.rows.size === 0) return;
    const rows = [...this.rows.values()];
    this.rows.clear();
    const supabase = createServiceClient();
    for (let i = 0; i < rows.length; i += this.batchSize) {
      const chunk = rows.slice(i, i + this.batchSize);
      const { error } = await supabase
        .from("company_website_scans")
        .upsert(chunk, { onConflict: "orgnr" });
      if (error) throw new Error(`Website scan batch upsert: ${error.message}`);
    }
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.op.then(fn);
    this.op = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }
}

export async function loadWebsiteScansByOrgnr(
  orgnrs: string[]
): Promise<Map<string, WebsiteScanResult | null>> {
  const map = new Map<string, WebsiteScanResult | null>();
  if (orgnrs.length === 0) return map;

  const supabase = createServiceClient();
  for (let i = 0; i < orgnrs.length; i += SELECT_CHUNK) {
    const batch = orgnrs.slice(i, i + SELECT_CHUNK);
    const { data, error } = await supabase
      .from("company_website_scans")
      .select("orgnr, scan")
      .in("orgnr", batch);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const scan = row.scan;
      map.set(
        row.orgnr as string,
        scan && typeof scan === "object" ? (scan as WebsiteScanResult) : null
      );
    }
  }
  for (const orgnr of orgnrs) {
    if (!map.has(orgnr)) map.set(orgnr, null);
  }
  return map;
}

export function applyBrregEnhetToCompany(enhet: BrregEnhet, existing: Company): Company {
  const mapped = mapBrregEnhet(enhet);
  const merged = preserveExistingContactFields(mapped, existing);
  const { industry_description, ...row } = merged;
  void industry_description;
  return { ...existing, ...row };
}

export function brregRowForUpsert(enhet: BrregEnhet, existing: Company): CompanyRow {
  const mapped = mapBrregEnhet(enhet);
  const merged = preserveExistingContactFields(mapped, existing);
  const { industry_description, ...row } = merged;
  void industry_description;
  return row as CompanyRow;
}

export class BrregRefreshBuffer {
  private rows = new Map<string, CompanyRow>();
  private readonly batchSize: number;
  private op = Promise.resolve();

  constructor(batchSize = ENRICH_BATCH_SIZE) {
    this.batchSize = batchSize;
  }

  queue(enhet: BrregEnhet, existing: Company): Promise<Company> {
    return this.run(async () => {
      const row = brregRowForUpsert(enhet, existing);
      this.rows.set(row.orgnr as string, row);
      if (this.rows.size >= this.batchSize) {
        await this.flushUnlocked();
      }
      return applyBrregEnhetToCompany(enhet, existing);
    });
  }

  flush(): Promise<void> {
    return this.run(() => this.flushUnlocked());
  }

  private async flushUnlocked(): Promise<void> {
    if (this.rows.size === 0) return;
    const rows = [...this.rows.values()];
    this.rows.clear();
    const supabase = createServiceClient();
    for (let i = 0; i < rows.length; i += this.batchSize) {
      const chunk = rows.slice(i, i + this.batchSize);
      const { error } = await supabase
        .from("companies")
        .upsert(chunk, { onConflict: "orgnr" });
      if (error) throw new Error(`Brreg batch upsert: ${error.message}`);
    }
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.op.then(fn);
    this.op = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }
}
