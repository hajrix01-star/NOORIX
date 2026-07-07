import { toYmd } from '../../../utils/saudiDate';

export type ReportsQueryValue = string | number | boolean | null | undefined;
export type ReportsQueryParams = Record<string, ReportsQueryValue>;

export type TaxVatReportQueryOptions = {
  salesAmountIncludesVat?: boolean;
};

export type VatPlanningRegistryQuery = {
  year?: string | number;
  quarter?: string | number;
  companyId?: string;
};

export function buildReportsApiQuery(params: ReportsQueryParams): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    query[key] = String(value);
  }
  return query;
}

export function withReportsApiQuery(path: string, params: ReportsQueryParams): string {
  const query = buildReportsApiQuery(params);
  const qs = new URLSearchParams(query).toString();
  return qs ? `${path}?${qs}` : path;
}

export function generalProfitLossQuery(
  companyId: string,
  year: string | number,
): Record<string, string> {
  return buildReportsApiQuery({
    companyId: String(companyId ?? '').trim(),
    year,
  });
}

export function generalProfitLossDetailsQuery(
  companyId: string,
  year: string | number,
  month: string | number | null | undefined,
  groupKey: string,
  itemKey?: string,
): Record<string, string> {
  return buildReportsApiQuery({
    companyId: String(companyId ?? '').trim(),
    year,
    month,
    groupKey: String(groupKey ?? '').trim(),
    itemKey: String(itemKey ?? '').trim(),
  });
}

export function generalProfitLossTrendQuery(
  companyId: string,
  year: string | number,
  groupKey: string,
  itemKey?: string,
): Record<string, string> {
  return buildReportsApiQuery({
    companyId: String(companyId ?? '').trim(),
    year,
    groupKey: String(groupKey ?? '').trim(),
    itemKey: String(itemKey ?? '').trim(),
  });
}

export function taxVatReportQuery(
  companyId: string,
  year: string | number,
  period: string,
  opts: TaxVatReportQueryOptions = {},
): Record<string, string> {
  return buildReportsApiQuery({
    companyId: String(companyId ?? '').trim(),
    year,
    period: String(period ?? '').trim(),
    salesAmountIncludesVat: opts.salesAmountIncludesVat === true ? 'true' : undefined,
  });
}

export function vatPlanningListQuery(
  year: string | number,
  quarter: string | number,
  companyId?: string,
): Record<string, string> {
  return buildReportsApiQuery({
    year,
    quarter,
    companyId: String(companyId ?? '').trim(),
  });
}

export function vatPlanningRegistryQuery(
  filters: VatPlanningRegistryQuery = {},
): Record<string, string> {
  return buildReportsApiQuery({
    year: filters.year,
    quarter: filters.quarter,
    companyId: String(filters.companyId ?? '').trim(),
  });
}

export function vatPlanningDeleteQuery(
  companyId: string,
  year: string | number,
  quarter: string | number,
): Record<string, string> {
  return buildReportsApiQuery({
    companyId: String(companyId ?? '').trim(),
    year,
    quarter,
  });
}

export function periodAnalyticsQuery(
  companyId: string,
  startDate: unknown,
  endDate: unknown,
): Record<string, string> {
  return buildReportsApiQuery({
    companyId: String(companyId ?? '').trim(),
    startDate: toYmd(startDate),
    endDate: toYmd(endDate),
  });
}
