import { Suspense } from "react";
import { AiSamtalerClient } from "./AiSamtalerClient";

export default function AiSamtalerPage() {
  return (
    <Suspense
      fallback={
        <div className="scan-glass-kommand px-3 py-6">
          <p className="scan-glass-muted text-sm">Laster AI-samtaler…</p>
        </div>
      }
    >
      <AiSamtalerClient />
    </Suspense>
  );
}
