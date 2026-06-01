import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Laster…</div>}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
