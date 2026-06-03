import { Suspense } from "react";
import InnstillingerClient from "./InnstillingerClient";

export default function InnstillingerPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-slate-600">Laster innstillinger…</p>
      }
    >
      <InnstillingerClient />
    </Suspense>
  );
}
