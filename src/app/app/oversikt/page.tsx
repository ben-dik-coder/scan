"use client";

import { SalesOverview } from "@/components/SalesOverview";
import { useDemoStats } from "@/lib/demo/store";

export default function OversiktPage() {
  const stats = useDemoStats();
  return <SalesOverview stats={stats} />;
}
