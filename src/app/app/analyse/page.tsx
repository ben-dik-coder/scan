import {
  AnalysePageFrame,
  loadAnalyseData,
} from "@/components/analyse/AnalysePage";
import { AnalyseOverviewSection } from "@/components/analyse/AnalyseSections";

export const dynamic = "force-dynamic";

export default async function AnalyseOverviewPage() {
  const data = await loadAnalyseData();
  return (
    <AnalysePageFrame data={data}>
      <AnalyseOverviewSection data={data} />
    </AnalysePageFrame>
  );
}
