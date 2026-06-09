/**
 * Holder alle aktive Bodø fast-enrich jobber i gang til de er ferdig.
 * Sjekker hvert 30. sekund om jobben kjører og om den er komplett.
 *
 * Start watchdog:
 *   nohup npx tsx scripts/run-bodo-enrich-watchdog.ts >> scripts/.cache/bodo-enrich-watchdog.log 2>&1 &
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient } from "../src/lib/supabase/service.ts";
import { getIndustryCodeOrFilters } from "../src/lib/constants/industries.ts";
import type { Company } from "../src/types/database.ts";

const KOMMUNE = "1804";
const POLL_MS = 30_000;
const CACHE = resolve(process.cwd(), "scripts/.cache");
const PID_FILE = resolve(CACHE, "bodo-enrich-watchdog.pid");

type JobKind = "standard" | "frisor";

type StandardProgress = {
  owners: string[];
  brreg: string[];
  contacts: string[];
  maps: string[];
};

type FrisorProgress = {
  owners: string[];
  contacts: string[];
  facebook: string[];
};

type JobDef = {
  id: string;
  label: string;
  script: string;
  progressFile: string;
  jobLogFile: string;
  industry: string;
  kind: JobKind;
};

const JOBS: JobDef[] = [
  {
    id: "eiendom",
    label: "Eiendom",
    script: "scripts/enrich-bodo-eiendom-fast.ts",
    progressFile: "bodo-eiendom-fast-progress.json",
    jobLogFile: "bodo-eiendom-fast.log",
    industry: "eiendom",
    kind: "standard",
  },
  {
    id: "helse",
    label: "Helse",
    script: "scripts/enrich-bodo-helse-fast.ts",
    progressFile: "bodo-helse-fast-progress.json",
    jobLogFile: "bodo-helse-fast.log",
    industry: "helse",
    kind: "standard",
  },
  {
    id: "reklame",
    label: "Reklame",
    script: "scripts/enrich-bodo-reklame-fast.ts",
    progressFile: "bodo-reklame-fast-progress.json",
    jobLogFile: "bodo-reklame-fast.log",
    industry: "reklame",
    kind: "standard",
  },
  {
    id: "kultur",
    label: "Kultur",
    script: "scripts/enrich-bodo-kultur-fast.ts",
    progressFile: "bodo-kultur-fast-progress.json",
    jobLogFile: "bodo-kultur-fast.log",
    industry: "kultur",
    kind: "standard",
  },
  {
    id: "frisor",
    label: "Frisør",
    script: "scripts/enrich-bodo-frisor-fast.ts",
    progressFile: "bodo-frisor-fast-progress.json",
    jobLogFile: "bodo-frisor-fast.log",
    industry: "frisor",
    kind: "frisor",
  },
];

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function hasPhone(c: Pick<Company, "phone" | "mobile">): boolean {
  return Boolean((c.mobile ?? "").trim() || (c.phone ?? "").trim());
}

function hasEmail(c: Pick<Company, "email">): boolean {
  return Boolean((c.email ?? "").trim());
}

function needsContact(c: Company): boolean {
  return !hasPhone(c) || !hasEmail(c);
}

function skipCompany(c: Company): boolean {
  const name = (c.name ?? "").toUpperCase();
  return name.includes("KONKURSBO") || name.includes("TVANGSAVVIKLINGSBO");
}

function loadStandardProgress(file: string): StandardProgress {
  const path = resolve(CACHE, file);
  if (!existsSync(path)) {
    return { owners: [], brreg: [], contacts: [], maps: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<StandardProgress>;
    return {
      owners: raw.owners ?? [],
      brreg: raw.brreg ?? [],
      contacts: raw.contacts ?? [],
      maps: raw.maps ?? [],
    };
  } catch {
    return { owners: [], brreg: [], contacts: [], maps: [] };
  }
}

function loadFrisorProgress(file: string): FrisorProgress {
  const path = resolve(CACHE, file);
  if (!existsSync(path)) {
    return { owners: [], contacts: [], facebook: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<FrisorProgress>;
    return {
      owners: raw.owners ?? [],
      contacts: raw.contacts ?? [],
      facebook: raw.facebook ?? [],
    };
  } catch {
    return { owners: [], contacts: [], facebook: [] };
  }
}

async function loadCompanies(industry: string): Promise<Company[]> {
  const supabase = createServiceClient();
  const codes = getIndustryCodeOrFilters(industry) ?? [];
  const pageSize = 1000;
  const rows: Company[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("municipality_code", KOMMUNE)
      .or(codes.join(","))
      .order("orgnr")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as Company[]));
    if (data.length < pageSize) break;
  }
  return rows;
}

async function loadFacebookMap(orgnrs: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (orgnrs.length === 0) return found;
  const supabase = createServiceClient();
  for (let i = 0; i < orgnrs.length; i += 80) {
    const batch = orgnrs.slice(i, i + 80);
    const { data } = await supabase
      .from("company_website_scans")
      .select("orgnr, scan")
      .in("orgnr", batch);
    for (const row of data ?? []) {
      const scan = row.scan as { facebookUrl?: string | null };
      if (scan.facebookUrl?.trim()) {
        found.add(row.orgnr as string);
      }
    }
  }
  return found;
}

function logSaysFerdig(job: JobDef): boolean {
  const path = resolve(CACHE, job.jobLogFile);
  if (!existsSync(path)) return false;
  try {
    const tail = readFileSync(path, "utf8").slice(-4000);
    return /\nFerdig\.\s*$/.test(tail) || tail.trimEnd().endsWith("Ferdig.");
  } catch {
    return false;
  }
}

type JobStatus = {
  complete: boolean;
  pendingContacts: number;
  pendingMaps: number;
  total: number;
  logFerdig: boolean;
};

async function getJobStatus(job: JobDef): Promise<JobStatus> {
  const companies = await loadCompanies(job.industry);
  const active = companies.filter((c) => !skipCompany(c));
  const logFerdig = logSaysFerdig(job);

  if (job.kind === "standard") {
    const progress = loadStandardProgress(job.progressFile);
    // Sjekket = ferdig, selv om vi ikke fant telefon/e-post («ingenting å finne»).
    const contactsDone = new Set(progress.contacts);
    const mapsDone = new Set(progress.maps);

    const pendingContacts = active.filter(
      (c) => needsContact(c) && !contactsDone.has(c.orgnr)
    ).length;
    const pendingMaps = active.filter(
      (c) => !hasPhone(c) && !mapsDone.has(c.orgnr)
    ).length;
    const complete = pendingContacts === 0 && pendingMaps === 0;

    return {
      complete: complete || (logFerdig && pendingContacts === 0 && pendingMaps === 0),
      pendingContacts,
      pendingMaps,
      total: active.length,
      logFerdig,
    };
  }

  const progress = loadFrisorProgress(job.progressFile);
  // Sjekket = ferdig, selv om vi ikke fant telefon/e-post («ingenting å finne»).
  const contactsDone = new Set(progress.contacts);
  const facebookDone = new Set(progress.facebook);
  const fbMap = await loadFacebookMap(active.map((c) => c.orgnr));

  const pendingContacts = active.filter(
    (c) => needsContact(c) && !contactsDone.has(c.orgnr)
  ).length;
  const pendingFacebook = active.filter(
    (c) => !fbMap.has(c.orgnr) && !facebookDone.has(c.orgnr)
  ).length;
  const complete = pendingContacts === 0 && pendingFacebook === 0;

  return {
    complete: complete || (logFerdig && pendingContacts === 0 && pendingFacebook === 0),
    pendingContacts,
    pendingMaps: pendingFacebook,
    total: active.length,
    logFerdig,
  };
}

function isRunnerUp(script: string): boolean {
  try {
    const ps = execSync(`pgrep -fl "${script}"`, { encoding: "utf8" });
    return ps
      .split("\n")
      .filter(Boolean)
      .some(
        (line) =>
          line.includes(script) &&
          !line.includes("run-bodo-enrich-watchdog") &&
          !line.includes("until-done")
      );
  } catch {
    return false;
  }
}

function startJob(job: JobDef) {
  const logPath = resolve(CACHE, job.jobLogFile);
  mkdirSync(CACHE, { recursive: true });
  const cmd = `nohup npx tsx ${job.script} >> ${logPath} 2>&1 &`;
  log(`${job.label}: starter på nytt → ${cmd}`);
  execSync(cmd, { cwd: process.cwd(), stdio: "ignore", shell: "/bin/bash" });
}

async function tick() {
  let allComplete = true;

  for (const job of JOBS) {
    const running = isRunnerUp(job.script);

    try {
      const status = await getJobStatus(job);

      if (status.complete) {
        log(
          `${job.label}: ferdig (${status.total} firma · kontakt igjen ${status.pendingContacts} · maps/fb igjen ${status.pendingMaps})`
        );
        continue;
      }

      allComplete = false;

      if (running) {
        log(
          `${job.label}: kjører (${status.total} firma · kontakt igjen ${status.pendingContacts} · maps/fb igjen ${status.pendingMaps})`
        );
        continue;
      }

      log(
        `${job.label}: stoppet men ikke ferdig (kontakt igjen ${status.pendingContacts} · maps/fb igjen ${status.pendingMaps}${status.logFerdig ? " · logg sier Ferdig." : ""})`
      );
      startJob(job);
    } catch (err) {
      allComplete = false;
      const msg = err instanceof Error ? err.message : String(err);
      log(`${job.label}: feil ved statussjekk — ${msg}`);
      if (!running) {
        log(`${job.label}: prøver restart etter feil…`);
        startJob(job);
      }
    }
  }

  return allComplete;
}

async function main() {
  loadEnvLocal();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(PID_FILE, String(process.pid));

  log(`Watchdog startet (pid ${process.pid}) — overvåker ${JOBS.map((j) => j.id).join(", ")}`);

  for (;;) {
    const done = await tick();
    if (done) {
      log("Alle jobber ferdig. Watchdog avslutter.");
      break;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  log(`Watchdog krasjet: ${msg}`);
  process.exit(1);
});
