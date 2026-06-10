import { getSessionUser } from "@/lib/auth";
import { fetchPipelineLeads } from "@/lib/companies";
import { isDemoMode } from "@/lib/demo/config";
import { Suspense } from "react";
import { PipelineClient } from "./PipelineClient";

export default async function PipelinePage() {
  const isDemo = isDemoMode();
  const user = await getSessionUser();

  let initialItems: Awaited<ReturnType<typeof fetchPipelineLeads>> = [];

  if (!isDemo && user) {
    try {
      initialItems = await fetchPipelineLeads(user.id);
    } catch {
      initialItems = [];
    }
  }

  return (
    <Suspense fallback={<p className="scan-glass-muted text-sm">Laster pipeline…</p>}>
      <PipelineClient initialItems={initialItems} isDemo={isDemo} />
    </Suspense>
  );
}
