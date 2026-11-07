import {
  AnalysePageFrame,
  loadAnalyseData,
} from "@/components/analyse/AnalysePage";
import { AnalyseSmsSection } from "@/components/analyse/AnalyseSections";

export const dynamic = "force-dynamic";

export default async function AnalyseSmsPage() {
  const data = await loadAnalyseData();
  return (
    <AnalysePageFrame data={data}>
      <AnalyseSmsSection data={data} />
    </AnalysePageFrame>
  );
}
