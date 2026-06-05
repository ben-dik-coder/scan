import type { Company } from "@/types/database";

export type CampaignTemplateVars = {
  firmanavn: string;
  orgnr: string;
};

export function buildCampaignVars(
  company: Pick<Company, "name" | "orgnr">
): CampaignTemplateVars {
  return {
    firmanavn: company.name,
    orgnr: company.orgnr,
  };
}
