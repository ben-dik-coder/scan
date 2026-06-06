import { getSessionUser } from "@/lib/auth";
import { fetchSequencesWithSteps } from "@/lib/companies";
import { isDemoMode } from "@/lib/demo/config";
import { seedDefaultSalesAssets } from "@/lib/sales/sequences";
import { SekvenserClient } from "./SekvenserClient";

export default async function SekvenserPage() {
  const isDemo = isDemoMode();
  const user = await getSessionUser();

  let initialSequences: Awaited<ReturnType<typeof fetchSequencesWithSteps>> = [];

  if (!isDemo && user) {
    try {
      await seedDefaultSalesAssets(user.id);
      initialSequences = await fetchSequencesWithSteps(user.id);
    } catch {
      initialSequences = [];
    }
  }

  return <SekvenserClient initialSequences={initialSequences} isDemo={isDemo} />;
}
