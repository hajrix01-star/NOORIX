/**
 * مفاتيح React Query — التقارير (Reports)
 * منفصلة عن ownerKeys.reports التي تتضمن مقطع 'owner' للاستعلامات الموازية.
 */
export const reportKeys = {
  generalProfitLoss: (companyId: string, year: number) =>
    ['reports', 'general-profit-loss', companyId, year] as const,

  generalProfitLossDetails: (
    companyId: string,
    year: number,
    month: number,
    groupKey: string,
    itemKey: string | undefined,
  ) =>
    ['reports', 'general-profit-loss', 'details', companyId, year, month, groupKey, itemKey || 'all'] as const,

  generalProfitLossTrend: (
    companyId: string,
    year: number,
    groupKey: string,
    itemKey: string | undefined,
  ) =>
    ['reports', 'general-profit-loss', 'trend', companyId, year, groupKey, itemKey || 'all'] as const,

  periodAnalytics: (companyId: string, startDate: string, endDate: string) =>
    ['reports', 'period-analytics', companyId, startDate, endDate] as const,

  taxVat: (
    companyId: string,
    year: number,
    period: string | number,
    salesAmountIncludesVat: boolean,
  ) =>
    ['reports', 'tax-vat', companyId, year, period, salesAmountIncludesVat] as const,
};
