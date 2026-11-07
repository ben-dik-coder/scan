import { AnalyseShell } from "@/components/analyse/AnalyseShell";
import { getSessionUser } from "@/lib/auth";
import { fetchAnalyseBundle } from "@/lib/analyse/fetch-analyse";
import {
  buildDemoAnalyseBundle,
  buildEmptyAnalyseBundle,
} from "@/lib/analyse/demo-data";
import { isDemoMode } from "@/lib/demo/config";
import type { AnalyseBundle } from "@/lib/analyse/types";

export async function loadAnalyseData(): Promise<AnalyseBundle> {
  if (isDemoMode()) return buildDemoAnalyseBundle();
  const user = await getSessionUser();
  if (!user) return buildEmptyAnalyseBundle();
  return fetchAnalyseBundle(user.id, 30);
}

export function AnalysePageFrame({
  data,
  children,
}: {
  data: AnalyseBundle;
  children: React.ReactNode;
}) {
  return (
    <AnalyseShell generatedAt={data.generatedAt}>{children}</AnalyseShell>
  );
}
