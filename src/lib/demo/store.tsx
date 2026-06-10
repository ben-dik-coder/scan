"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  CompanyWithLead,
  EmailCampaign,
  EmailTemplate,
  LeadStatus,
  SavedList,
} from "@/types/database";
import {
  buildDemoCompanies,
  DEMO_CAMPAIGNS,
  DEMO_SAVED_LISTS,
  DEMO_SEQUENCES,
  DEMO_TEMPLATES,
} from "./data";
import { matchesIndustryGroup } from "@/lib/constants/industries";
import {
  matchesProfessionSearch,
  resolveProfessionFilter,
} from "@/lib/constants/professions";
import { companyNameMatchesQuery } from "@/lib/brreg/name-search";
import { kommuneBelongsToRegion } from "@/lib/constants/regions";
import { computeLeadScore } from "@/lib/sales/lead-score";

type Sequence = (typeof DEMO_SEQUENCES)[number];

type DemoContextValue = {
  companies: CompanyWithLead[];
  templates: EmailTemplate[];
  sequences: Sequence[];
  campaigns: EmailCampaign[];
  campaignRecipients: Record<string, string[]>;
  savedLists: SavedList[];
  updateLeadStatus: (
    orgnr: string,
    status: LeadStatus,
    options?: { queue?: boolean; unqueue?: boolean }
  ) => void;
  setLeadStatus: (
    orgnr: string,
    status: LeadStatus,
    options?: { queue?: boolean; unqueue?: boolean }
  ) => void;
  deleteLead: (orgnr: string) => void;
  addTemplate: (t: Omit<EmailTemplate, "id" | "user_id" | "created_at" | "updated_at">) => void;
  removeTemplate: (id: string) => void;
  sendCampaignDemo: (orgnrs: string[], subject: string) => void;
  enrollSequenceDemo: (sequenceId: string, orgnrs: string[]) => void;
  saveListDemo: (name: string, filters: Record<string, unknown>) => void;
  updateSavedListDemo: (
    id: string,
    filters: Record<string, unknown>,
    name?: string
  ) => void;
  deleteSavedListDemo: (id: string) => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState(buildDemoCompanies);
  const [templates, setTemplates] = useState(DEMO_TEMPLATES);
  const [sequences] = useState(DEMO_SEQUENCES);
  const [campaigns, setCampaigns] = useState(DEMO_CAMPAIGNS);
  const [campaignRecipients, setCampaignRecipients] = useState<Record<string, string[]>>(
    {}
  );
  const [savedLists, setSavedLists] = useState<SavedList[]>(DEMO_SAVED_LISTS);

  const setLeadStatus = useCallback(
    (
      orgnr: string,
      status: LeadStatus,
      options?: { queue?: boolean; unqueue?: boolean }
    ) => {
      const now = new Date().toISOString();
      setCompanies((prev) =>
        prev.map((c) => {
          if (c.orgnr !== orgnr) return c;
          const queuedAt =
            options?.unqueue || status === "ikke_interessert"
              ? null
              : options?.queue && status === "ny"
                ? now
                : c.user_lead?.queued_at ?? null;

          if (c.user_lead) {
            return {
              ...c,
              user_lead: {
                ...c.user_lead,
                status,
                queued_at: queuedAt,
                updated_at: now,
                last_contacted_at:
                  status === "kontaktet" ? now : c.user_lead.last_contacted_at,
              },
            };
          }
          return {
            ...c,
            user_lead: {
              user_id: "demo-user",
              orgnr,
              status,
              score: computeLeadScore(c),
              notes: null,
              last_contacted_at: status === "kontaktet" ? now : null,
              next_follow_up_at: null,
              queued_at: queuedAt,
              created_at: now,
              updated_at: now,
            },
          };
        })
      );
    },
    []
  );

  const updateLeadStatus = setLeadStatus;

  const deleteLead = useCallback((orgnr: string) => {
    setCompanies((prev) =>
      prev.map((c) => (c.orgnr === orgnr ? { ...c, user_lead: null } : c))
    );
  }, []);

  const addTemplate = useCallback(
    (t: Omit<EmailTemplate, "id" | "user_id" | "created_at" | "updated_at">) => {
      const now = new Date().toISOString();
      setTemplates((prev) => [
        {
          ...t,
          id: `tpl-${Date.now()}`,
          user_id: "demo-user",
          created_at: now,
          updated_at: now,
        },
        ...prev,
      ]);
    },
    []
  );

  const removeTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const sendCampaignDemo = useCallback((orgnrs: string[], subject: string) => {
    setCompanies((prev) =>
      prev.map((c) =>
        orgnrs.includes(c.orgnr) && c.user_lead
          ? {
              ...c,
              user_lead: {
                ...c.user_lead,
                status: "kontaktet" as LeadStatus,
                last_contacted_at: new Date().toISOString(),
              },
            }
          : c
      )
    );
    const campaignId = `camp-${Date.now()}`;
    setCampaigns((prev) => [
      {
        id: campaignId,
        user_id: "demo-user",
        subject,
        subject_b: null,
        body: "",
        sent_count: orgnrs.length,
        failed_count: 0,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setCampaignRecipients((prev) => ({ ...prev, [campaignId]: orgnrs }));
  }, []);

  const enrollSequenceDemo = useCallback((_sequenceId: string, orgnrs: string[]) => {
    setCompanies((prev) =>
      prev.map((c) =>
        orgnrs.includes(c.orgnr) && c.user_lead
          ? { ...c, user_lead: { ...c.user_lead, status: "kontaktet" as LeadStatus } }
          : c
      )
    );
  }, []);

  const saveListDemo = useCallback((name: string, filters: Record<string, unknown>) => {
    setSavedLists((prev) => [
      {
        id: `list-${Date.now()}`,
        user_id: "demo-user",
        name,
        filters,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);

  const updateSavedListDemo = useCallback(
    (id: string, filters: Record<string, unknown>, name?: string) => {
      setSavedLists((prev) =>
        prev.map((list) =>
          list.id === id
            ? { ...list, filters, name: name?.trim() ? name.trim() : list.name }
            : list
        )
      );
    },
    []
  );

  const deleteSavedListDemo = useCallback((id: string) => {
    setSavedLists((prev) => prev.filter((list) => list.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      companies,
      templates,
      sequences,
      campaigns,
      campaignRecipients,
      savedLists,
      updateLeadStatus,
      setLeadStatus,
      deleteLead,
      addTemplate,
      removeTemplate,
      sendCampaignDemo,
      enrollSequenceDemo,
      saveListDemo,
      updateSavedListDemo,
      deleteSavedListDemo,
    }),
    [
      companies,
      templates,
      sequences,
      campaigns,
      campaignRecipients,
      savedLists,
      updateLeadStatus,
      setLeadStatus,
      deleteLead,
      addTemplate,
      removeTemplate,
      sendCampaignDemo,
      enrollSequenceDemo,
      saveListDemo,
      updateSavedListDemo,
      deleteSavedListDemo,
    ]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}

export function useDemoStats() {
  const { companies, campaigns } = useDemo();
  const statusCounts: Record<string, number> = {};
  for (const c of companies) {
    const s = c.user_lead?.status ?? "ny";
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }
  return {
    totalLeads: companies.length,
    statusCounts,
    totalSent: campaigns.reduce((s, c) => s + c.sent_count, 0),
    totalFailed: campaigns.reduce((s, c) => s + c.failed_count, 0),
    activeSequences: 3,
    dueFollowUps: companies.filter(
      (c) => c.user_lead?.next_follow_up_at && new Date(c.user_lead.next_follow_up_at) <= new Date()
    ).length,
    totalActivities: 47,
  };
}

export function filterDemoCompanies(
  companies: CompanyWithLead[],
  filters: {
    regionId?: string;
    municipalityCode?: string;
    days?: number;
    hasEmail?: boolean;
    genericEmailOnly?: boolean;
    industryGroup?: string;
    professionId?: string;
    nameQuery?: string;
    minScore?: number;
  }
) {
  const allTime = filters.days === 0;
  const since = new Date();
  since.setDate(since.getDate() - (filters.days ?? 30));
  const sinceStr = since.toISOString().slice(0, 10);

  return companies.filter((c) => {
    if (!allTime && c.registered_at && c.registered_at < sinceStr) return false;
    if (
      filters.municipalityCode &&
      c.municipality_code !== filters.municipalityCode
    )
      return false;
    if (
      filters.regionId &&
      !filters.municipalityCode &&
      !kommuneBelongsToRegion(c.municipality_code, filters.regionId)
    )
      return false;
    if (filters.hasEmail && !c.has_email) return false;
    if (filters.genericEmailOnly && !c.email_is_generic) return false;
    if (
      !matchesIndustryGroup(c.industry_code, filters.industryGroup ?? "", {
        name: c.name,
        industryDescription: c.industry_description,
      })
    ) {
      return false;
    }
    if (filters.professionId?.trim()) {
      const professionMatch = resolveProfessionFilter(filters.professionId);
      if (
        professionMatch &&
        !matchesProfessionSearch(c.industry_code, {
          name: c.name,
          industryDescription: c.industry_description,
        }, professionMatch)
      ) {
        return false;
      }
    }
    if (!companyNameMatchesQuery(c.name, filters.nameQuery)) return false;
    if (filters.minScore && (c.user_lead?.score ?? 0) < filters.minScore) return false;
    return true;
  });
}

export { computeLeadScore };
