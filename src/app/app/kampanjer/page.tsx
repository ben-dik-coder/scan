"use client";

import { CampaignsList } from "@/components/SalesOverview";
import { useDemo } from "@/lib/demo/store";

export default function KampanjerPage() {
  const { campaigns } = useDemo();
  return <CampaignsList campaigns={campaigns} />;
}
