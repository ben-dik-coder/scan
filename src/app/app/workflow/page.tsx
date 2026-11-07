import { Route } from "lucide-react";
import { AppPlaceholderPage } from "@/components/layout/AppPlaceholderPage";

export default function WorkflowPage() {
  return (
    <AppPlaceholderPage
      title="Workflow"
      description="Bygg og følg arbeidsflyter fra lead til møte — steg, eiere og neste handling i samme spor."
      icon={Route}
      primaryHref="/app/sekvenser"
      primaryLabel="Åpne sekvenser"
    />
  );
}
