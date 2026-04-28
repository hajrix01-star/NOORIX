/**
 * Props for dashboard sales calendar — unchanged from legacy component contract.
 */
export interface DashboardCalendarTabProps {
  companyId?: string | null;
  year: number;
  selectedMonth?: number | null;
  /** Reserved for parent API compatibility; not used by calendar UI */
  filter?: unknown;
}
