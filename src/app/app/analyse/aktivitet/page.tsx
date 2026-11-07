import {
  AnalysePageFrame,
  loadAnalyseData,
} from "@/components/analyse/AnalysePage";
import { AnalyseAktivitetSection } from "@/components/analyse/AnalyseSections";

export const dynamic = "force-dynamic";

export default async function AnalyseAktivitetPage() {
  const data = await loadAnalyseData();
  return (
    <AnalysePageFrame data={data}>
      <AnalyseAktivitetSection data={data} />
    </AnalysePageFrame>
  );
}
