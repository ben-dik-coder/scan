import { LegalLayout } from "@/components/legal/LegalLayout";
import { PersonvernContent } from "@/content/legal-personvern";

export const metadata = {
  title: "Personvernerklæring — NyLead",
  description: "Hvordan NyLead behandler personopplysninger.",
};

export default function PersonvernPage() {
  return (
    <LegalLayout title="Personvernerklæring">
      <PersonvernContent />
    </LegalLayout>
  );
}
