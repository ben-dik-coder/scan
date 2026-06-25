import { Suspense } from "react";
import { SmartlistePageInner } from "./SmartlistePageInner";

export default function SmartlistePage() {
  return (
    <Suspense fallback={null}>
      <SmartlistePageInner />
    </Suspense>
  );
}
