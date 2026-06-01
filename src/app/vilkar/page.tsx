import { LegalLayout } from "@/components/legal/LegalLayout";
import { VilkarContent } from "@/content/legal-vilkar";

export const metadata = {
  title: "Vilkår for bruk — NyLead",
  description: "Vilkår, ansvar og brukerforpliktelser for NyLead.",
};

export default function VilkarPage() {
  return (
    <LegalLayout title="Vilkår for bruk">
      <VilkarContent />
    </LegalLayout>
  );
}
