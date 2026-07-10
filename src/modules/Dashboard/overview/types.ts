/**
 * أنواع تبويب نظرة عامة للوحة التحكم
 */
export type DashboardOverviewFilter = {
  label?: string;
  periodStart?: string;
  periodEnd?: string;
  isCustomRange?: boolean;
};

export type DashboardOverviewTabProps = {
  companyId: string;
  year: number;
  selectedMonth: number | null;
  filter?: DashboardOverviewFilter;
};
