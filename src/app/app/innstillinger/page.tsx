import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth";
import InnstillingerClient from "./InnstillingerClient";

export default async function InnstillingerPage() {
  const user = await getSessionUser();

  return (
    <Suspense
      fallback={
        <div className="scan-glass-kommand px-3 py-6">
          <p className="scan-glass-muted text-sm">Laster innstillinger…</p>
        </div>
      }
    >
      <InnstillingerClient userEmail={user?.email ?? null} />
    </Suspense>
  );
}
