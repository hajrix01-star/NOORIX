/**
 * أنواع تبويب نظرة عامة للوحة التحكم
 */
export type DashboardOverviewFilter = {
  label?: string;
};

export type DashboardOverviewTabProps = {
  companyId: string;
  year: number;
  selectedMonth: number | null;
  filter?: DashboardOverviewFilter;
};
