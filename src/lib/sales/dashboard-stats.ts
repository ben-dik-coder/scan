export type SalesDashboardStats = {
  totalLeads: number;
  statusCounts: Record<string, number>;
  totalSent: number;
  totalFailed: number;
  activeSequences: number;
  dueFollowUps: number;
  totalActivities: number;
};

export const EMPTY_SALES_DASHBOARD: SalesDashboardStats = {
  totalLeads: 0,
  statusCounts: {},
  totalSent: 0,
  totalFailed: 0,
  activeSequences: 0,
  dueFollowUps: 0,
  totalActivities: 0,
};
