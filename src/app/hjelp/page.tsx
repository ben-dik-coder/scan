import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { HjelpContent } from "@/content/hjelp";
import { support } from "@/lib/support";

export const metadata: Metadata = {
  title: "Hjelp og support",
  description: `Kontakt ${support.email} — svar innen 24 timer. Ring ${support.phoneDisplay}, åpent ${support.phoneHoursLabel.toLowerCase()}.`,
  alternates: {
    canonical: "/hjelp",
  },
};

export default function HjelpPage() {
  return (
    <LegalLayout title="Hjelp og support">
      <HjelpContent />
    </LegalLayout>
  );
}
