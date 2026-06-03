import { SalesOverview } from "@/components/SalesOverview";
import { getSessionUser } from "@/lib/auth";
import { fetchSalesDashboard } from "@/lib/companies";
import { isDemoMode } from "@/lib/demo/config";
import { EMPTY_SALES_DASHBOARD } from "@/lib/sales/dashboard-stats";
import { OversiktDemo } from "./OversiktDemo";

export default async function OversiktPage() {
  if (isDemoMode()) {
    return <OversiktDemo />;
  }

  const user = await getSessionUser();
  if (!user) {
    return <SalesOverview stats={EMPTY_SALES_DASHBOARD} />;
  }

  const stats = await fetchSalesDashboard(user.id);
  return <SalesOverview stats={stats} />;
}
