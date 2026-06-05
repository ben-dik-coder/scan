import { getSessionUser } from "@/lib/auth";
import { fetchPipelineLeads } from "@/lib/companies";
import { isDemoMode } from "@/lib/demo/config";
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

  return <PipelineClient initialItems={initialItems} isDemo={isDemo} />;
}
