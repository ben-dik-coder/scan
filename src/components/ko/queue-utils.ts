import type { Company } from "@/types/database";
import type { QueueItemResponse } from "@/lib/sales/queue-score";

export function queueItemToCompany(item: QueueItemResponse): Company {
  const now = new Date().toISOString();
  return {
    orgnr: item.orgnr,
    name: item.name,
    email: item.email,
    phone: item.phone,
    mobile: null,
    municipality_code: null,
    municipality_name: item.municipalityName,
    city: null,
    website: null,
    industry_code: null,
    registered_at: item.registeredAt,
    has_email: Boolean(item.email),
    email_is_generic: false,
    brreg_updated_at: null,
    daglig_leder: item.dagligLeder,
    created_at: item.registeredAt ?? now,
    updated_at: now,
  };
}

export function filterQueueItems(
  items: QueueItemResponse[],
  options: {
    search?: string;
    noWebsite?: boolean;
    hasPhone?: boolean;
    skippedOrgnrs?: Set<string>;
  }
): QueueItemResponse[] {
  const q = options.search?.trim().toLowerCase();
  return items.filter((item) => {
    if (options.skippedOrgnrs?.has(item.orgnr)) return false;
    if (q && !item.name.toLowerCase().includes(q)) return false;
    if (options.noWebsite && item.hasWebsite !== false) return false;
    if (options.hasPhone && !item.phone) return false;
    return true;
  });
}
