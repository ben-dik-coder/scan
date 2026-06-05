import type { CampaignListItem } from "@/types/database";

export function filterCampaigns(
  campaigns: CampaignListItem[],
  options: {
    search?: string;
    hasFailures?: boolean;
    last30Days?: boolean;
  }
): CampaignListItem[] {
  const q = options.search?.trim().toLowerCase();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  return campaigns.filter((c) => {
    if (q && !c.subject.toLowerCase().includes(q)) return false;
    if (options.hasFailures && c.failed_count <= 0) return false;
    if (options.last30Days && new Date(c.created_at) < since) return false;
    return true;
  });
}

export function formatCampaignDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function campaignStats(campaigns: CampaignListItem[]) {
  return {
    count: campaigns.length,
    totalSent: campaigns.reduce((s, c) => s + c.sent_count, 0),
    totalFailed: campaigns.reduce((s, c) => s + c.failed_count, 0),
  };
}
