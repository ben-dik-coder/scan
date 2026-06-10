import {
  AGENT_MAX_SCAN_PER_CALL,
  AGENT_MAX_SCAN_PER_JOB,
} from "@/lib/agent/constants";
import {
  executeAgentTool,
  type AgentToolContext,
  type ToolExecutionResult,
} from "@/lib/agent/execute-tool";

export type ChunkedScanItem = {
  orgnr: string;
  displayName?: string | null;
  hasWebsite?: boolean;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  countsAsNoWebsite?: boolean;
};

export type ChunkedScanResult = {
  scans: ChunkedScanItem[];
  serperLimited: boolean;
  remaining: number;
  summaries: string[];
};

type ChunkedScanHooks = {
  onBatchStart?: (batchIndex: number, batchTotal: number) => Promise<void>;
  onBatchEnd?: (summary: string) => Promise<void>;
  onProgress?: (scanned: number, total: number) => Promise<void>;
};

function uniqueOrgnrs(orgnrs: string[]): string[] {
  return Array.from(new Set(orgnrs.map((o) => o.trim()).filter(Boolean)));
}

export function capScanJobOrgnrs(orgnrs: string[], maxTotal = AGENT_MAX_SCAN_PER_JOB): {
  orgnrs: string[];
  remaining: number;
} {
  const unique = uniqueOrgnrs(orgnrs);
  const capped = unique.slice(0, maxTotal);
  return {
    orgnrs: capped,
    remaining: Math.max(0, unique.length - capped.length),
  };
}

function extractScans(result: ToolExecutionResult): ChunkedScanItem[] {
  return (
    Array.isArray(result.data.scans)
      ? (result.data.scans as Array<{
          orgnr?: string;
          displayName?: string | null;
          hasWebsite?: boolean;
          websiteUrl?: string | null;
          facebookUrl?: string | null;
          countsAsNoWebsite?: boolean;
        }>)
      : []
  ).filter((scan): scan is ChunkedScanItem => Boolean(scan.orgnr));
}

/** Kjør scan_websites i batcher med felles fremdrift — maks AGENT_MAX_SCAN_PER_JOB totalt. */
export async function runChunkedWebsiteScans(
  ctx: AgentToolContext,
  requestedOrgnrs: string[],
  hooks?: ChunkedScanHooks,
  options?: { includeFacebook?: boolean; maxTotal?: number }
): Promise<ChunkedScanResult> {
  const maxTotal = options?.maxTotal ?? AGENT_MAX_SCAN_PER_JOB;
  const { orgnrs: jobOrgnrs, remaining: overJobLimit } = capScanJobOrgnrs(
    requestedOrgnrs,
    maxTotal
  );

  if (jobOrgnrs.length === 0) {
    return { scans: [], serperLimited: false, remaining: 0, summaries: [] };
  }

  const batches: string[][] = [];
  for (let i = 0; i < jobOrgnrs.length; i += AGENT_MAX_SCAN_PER_CALL) {
    batches.push(jobOrgnrs.slice(i, i + AGENT_MAX_SCAN_PER_CALL));
  }

  const allScans: ChunkedScanItem[] = [];
  const summaries: string[] = [];
  let serperLimited = false;
  let toolRemaining = overJobLimit;

  const progressCtx: AgentToolContext = {
    ...ctx,
    onProgress: async (progress) => {
      const globalScanned =
        allScans.length + Math.min(progress.scanned, progress.total);
      await hooks?.onProgress?.(globalScanned, jobOrgnrs.length);
    },
  };

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    await hooks?.onBatchStart?.(batchIndex + 1, batches.length);

    let scanResult: ToolExecutionResult;
    try {
      scanResult = await executeAgentTool(progressCtx, "scan_websites", {
        orgnrs: batch,
        includeFacebook: options?.includeFacebook === true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      scanResult = { summary: `Feil: ${message}`, data: { error: message } };
    }

    summaries.push(scanResult.summary);
    await hooks?.onBatchEnd?.(scanResult.summary);

    allScans.push(...extractScans(scanResult));

    if (scanResult.data.serperLimitReached === true) {
      serperLimited = true;
      const pending = Array.isArray(scanResult.data.remainingOrgnrs)
        ? (scanResult.data.remainingOrgnrs as string[])
        : [];
      toolRemaining = pending.length + overJobLimit;
      break;
    }

    const pending = Array.isArray(scanResult.data.remainingOrgnrs)
      ? (scanResult.data.remainingOrgnrs as string[])
      : [];
    if (pending.length > 0) {
      toolRemaining = pending.length + overJobLimit;
      break;
    }

    await hooks?.onProgress?.(allScans.length, jobOrgnrs.length);
  }

  return {
    scans: allScans,
    serperLimited,
    remaining: toolRemaining,
    summaries,
  };
}
