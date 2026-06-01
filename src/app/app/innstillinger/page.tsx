import { Suspense } from "react";
import InnstillingerClient from "./InnstillingerClient";

export default function InnstillingerPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-white/60">Laster innstillinger…</p>
      }
    >
      <InnstillingerClient />
    </Suspense>
  );
}
