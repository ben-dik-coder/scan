import { Suspense } from "react";
import { RingClient } from "./RingClient";

export default function RingPage() {
  return (
    <Suspense fallback={<p className="scan-glass-muted p-4 text-sm">Laster ringemodus…</p>}>
      <RingClient />
    </Suspense>
  );
}
