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
    <Suspense
      fallback={
        <p className="flex min-h-[40vh] items-center justify-center bg-[#0a0a0a] text-sm text-zinc-500">
          Laster pipeline…
        </p>
      }
    >
      <PipelineClient initialItems={initialItems} isDemo={isDemo} />
    </Suspense>
  );
}
