import { Suspense } from "react";
import { SmsClient } from "./SmsClient";

export default function SmsPage() {
  return (
    <Suspense fallback={<p className="scan-glass-muted p-4 text-sm">Laster SMS-modus…</p>}>
      <SmsClient />
    </Suspense>
  );
}
