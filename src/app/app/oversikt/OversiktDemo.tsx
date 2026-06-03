"use client";

import { SalesOverview } from "@/components/SalesOverview";
import { useDemoStats } from "@/lib/demo/store";

export function OversiktDemo() {
  const stats = useDemoStats();
  return <SalesOverview stats={stats} />;
}
