import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Opprett konto",
  description:
    "Opprett konto i NyLead og start med å finne nye firma, kontaktinfo og B2B-leads i Norge.",
  alternates: {
    canonical: "/registrer",
  },
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Laster…</div>}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
