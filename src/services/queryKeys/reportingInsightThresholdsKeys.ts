/**
 * React Query keys — company insight threshold settings (reporting)
 */
export const reportingInsightThresholdsKeys = {
  root: () => ['reporting-insight-thresholds'] as const,

  /** Resolved thresholds for one company */
  company: (companyId: string) => ['reporting-insight-thresholds', companyId] as const,
};
