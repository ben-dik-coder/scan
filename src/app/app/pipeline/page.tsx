"use client";

import { PipelineBoard, PipelineClosed } from "@/components/PipelineBoard";
import { PageHeader } from "@/components/ui/primitives";
import { useDemo } from "@/lib/demo/store";

export default function PipelinePage() {
  const { companies, updateLeadStatus } = useDemo();

  const items = companies.map((c) => ({
    lead: c.user_lead!,
    company: c,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Dra leads gjennom salgsprosessen — fra ny til møte booket"
      />
      <PipelineBoard items={items} onStatusChange={updateLeadStatus} />
      <PipelineClosed items={items} onStatusChange={updateLeadStatus} />
    </div>
  );
}
