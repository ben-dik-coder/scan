import type { Company, UserLead } from "@/types/database";

export type PipelineItem = {
  lead: UserLead;
  company: Company;
};

export const ACTIVE_PIPELINE_STATUSES = [
  "ny",
  "kontaktet",
  "svarte",
  "moete_booket",
] as const;

export const CLOSED_PIPELINE_STATUSES = [
  "vunnet",
  "tapt",
  "ikke_interessert",
] as const;
