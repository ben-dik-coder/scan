export type AnalyseRangeDays = 7 | 30 | 90;

export type AnalyseKpi = {
  id: string;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
};

export type AnalyseNamedCount = {
  id: string;
  label: string;
  count: number;
};

export type AnalyseDayPoint = {
  date: string; // YYYY-MM-DD
  label: string;
  count: number;
};

export type AnalyseCallStats = {
  total: number;
  byStatus: AnalyseNamedCount[];
  byOutcome: AnalyseNamedCount[];
  connectRate: number | null;
  meetingRate: number | null;
  last7Days: AnalyseDayPoint[];
};

export type AnalyseEmailStats = {
  campaignSent: number;
  campaignFailed: number;
  failRate: number | null;
  enrollmentsByStatus: AnalyseNamedCount[];
  activeEnrollments: number;
};

export type AnalyseActivityStats = {
  total: number;
  byType: AnalyseNamedCount[];
  last14Days: AnalyseDayPoint[];
  smsRelated: number;
  callRelated: number;
  emailRelated: number;
};

export type AnalyseProspectingStats = {
  totalLeads: number;
  queued: number;
  dueFollowUps: number;
  contactedShare: number | null;
  wonShare: number | null;
};

export type AnalyseCostStats = {
  serperUsed: number;
  serperLimit: number;
  serperRemaining: number;
  aiCallsThisMonth: number;
  aiCallsLast30: number;
};

export type AnalyseBundle = {
  generatedAt: string;
  rangeDays: AnalyseRangeDays;
  healthScore: number;
  healthLabel: string;
  healthHints: string[];
  kpis: AnalyseKpi[];
  pipeline: AnalyseNamedCount[];
  conversion: {
    contactedOfTotal: number | null;
    repliedOfContacted: number | null;
    meetingOfReplied: number | null;
    wonOfMeeting: number | null;
  };
  calls: AnalyseCallStats;
  email: AnalyseEmailStats;
  activity: AnalyseActivityStats;
  prospecting: AnalyseProspectingStats;
  costs: AnalyseCostStats;
};
