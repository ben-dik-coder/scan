import { getSessionUser } from "@/lib/auth";
import { fetchCampaigns } from "@/lib/companies";
import { isDemoMode } from "@/lib/demo/config";
import { KampanjerClient } from "./KampanjerClient";

export default async function KampanjerPage() {
  const isDemo = isDemoMode();
  const user = await getSessionUser();

  let initialCampaigns: Awaited<ReturnType<typeof fetchCampaigns>> = [];

  if (!isDemo && user) {
    try {
      initialCampaigns = await fetchCampaigns(user.id);
    } catch {
      initialCampaigns = [];
    }
  }

  return <KampanjerClient initialCampaigns={initialCampaigns} isDemo={isDemo} />;
}
