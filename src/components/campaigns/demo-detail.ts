import type { CampaignDetail, CampaignListItem, CompanyWithLead } from "@/types/database";

export function buildDemoCampaignDetail(
  campaign: CampaignListItem,
  companies: CompanyWithLead[],
  campaignOrgnrs?: string[]
): CampaignDetail {
  const pool =
    campaignOrgnrs && campaignOrgnrs.length > 0
      ? companies.filter((c) => campaignOrgnrs.includes(c.orgnr))
      : companies.filter((c) => c.has_email).slice(0, campaign.sent_count + campaign.failed_count);

  const recipients = pool.map((company, index) => {
    const isFailed = index < campaign.failed_count;
    return {
      id: `demo-recipient-${campaign.id}-${index}`,
      orgnr: company.orgnr,
      companyName: company.name,
      email: company.email ?? "ukjent@epost.no",
      status: isFailed ? ("failed" as const) : ("sent" as const),
      error_message: isFailed ? "Demo: simulert sendefeil" : null,
      ab_variant: campaign.subject_b ? (index % 2 === 0 ? ("a" as const) : ("b" as const)) : null,
      sent_at: isFailed ? null : campaign.created_at,
    };
  });

  return {
    campaign,
    recipients,
  };
}
