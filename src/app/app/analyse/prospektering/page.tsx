import {
  AnalysePageFrame,
  loadAnalyseData,
} from "@/components/analyse/AnalysePage";
import { AnalyseProspekteringSection } from "@/components/analyse/AnalyseSections";

export const dynamic = "force-dynamic";

export default async function AnalyseProspekteringPage() {
  const data = await loadAnalyseData();
  return (
    <AnalysePageFrame data={data}>
      <AnalyseProspekteringSection data={data} />
    </AnalysePageFrame>
  );
}
