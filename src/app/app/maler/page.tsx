import { getSessionUser } from "@/lib/auth";
import { fetchTemplates } from "@/lib/companies";
import { isDemoMode } from "@/lib/demo/config";
import { seedDefaultSalesAssets } from "@/lib/sales/sequences";
import { MalerClient } from "./MalerClient";

export default async function MalerPage() {
  const isDemo = isDemoMode();
  const user = await getSessionUser();

  let initialTemplates: Awaited<ReturnType<typeof fetchTemplates>> = [];

  if (!isDemo && user) {
    try {
      await seedDefaultSalesAssets(user.id);
      initialTemplates = await fetchTemplates(user.id);
    } catch {
      initialTemplates = [];
    }
  }

  return <MalerClient initialTemplates={initialTemplates} isDemo={isDemo} />;
}
