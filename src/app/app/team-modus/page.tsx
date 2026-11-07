import { UsersRound } from "lucide-react";
import { AppPlaceholderPage } from "@/components/layout/AppPlaceholderPage";

export default function TeamModusPage() {
  return (
    <AppPlaceholderPage
      title="Team modus"
      description="Del køer, pipeline og manus med teamet — se hvem som eier hva, uten at trådene går i surr."
      icon={UsersRound}
      primaryHref="/app/pipeline"
      primaryLabel="Åpne pipeline"
    />
  );
}