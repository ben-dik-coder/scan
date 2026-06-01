import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Laster…</div>}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
