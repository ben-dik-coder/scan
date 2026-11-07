import {
  AnalysePageFrame,
  loadAnalyseData,
} from "@/components/analyse/AnalysePage";
import { AnalyseKostnaderSection } from "@/components/analyse/AnalyseSections";

export const dynamic = "force-dynamic";

export default async function AnalyseKostnaderPage() {
  const data = await loadAnalyseData();
  return (
    <AnalysePageFrame data={data}>
      <AnalyseKostnaderSection data={data} />
    </AnalysePageFrame>
  );
}
