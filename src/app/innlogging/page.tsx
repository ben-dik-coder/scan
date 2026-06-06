import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Logg inn",
  description: "Logg inn i NyLead for å jobbe med leads, arbeidskø, pipeline og e-post.",
  alternates: {
    canonical: "/innlogging",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Laster…</div>}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
