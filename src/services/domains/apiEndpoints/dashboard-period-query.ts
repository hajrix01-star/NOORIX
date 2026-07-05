import { toYmd } from '../../../utils/saudiDate';

export interface DashboardPeriodApiParams {
  companyId: string;
  year: number;
  yearStart: string;
  yearEnd: string;
  periodStart: string;
  periodEnd: string;
  dailyStart?: string | null;
  dailyEnd?: string | null;
  monthStart?: string | null;
  monthEnd?: string | null;
  selectedMonth?: number | null;
  includeCancelledSales?: boolean;
}

export function buildDashboardPeriodQuery(params: DashboardPeriodApiParams): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {
    companyId: String(params.companyId),
    year: params.year,
    yearStart: toYmd(params.yearStart),
    yearEnd: toYmd(params.yearEnd),
    periodStart: toYmd(params.periodStart),
    periodEnd: toYmd(params.periodEnd),
  };

  addOptionalYmd(query, 'dailyStart', params.dailyStart);
  addOptionalYmd(query, 'dailyEnd', params.dailyEnd);
  addOptionalYmd(query, 'monthStart', params.monthStart);
  addOptionalYmd(query, 'monthEnd', params.monthEnd);

  if (params.selectedMonth != null && params.selectedMonth >= 1 && params.selectedMonth <= 12) {
    query.selectedMonth = params.selectedMonth;
  }
  if (params.includeCancelledSales === true) {
    query.includeCancelledSales = true;
  }

  return query;
}

function addOptionalYmd(
  query: Record<string, string | number | boolean>,
  key: 'dailyStart' | 'dailyEnd' | 'monthStart' | 'monthEnd',
  value: string | null | undefined,
) {
  const ymd = value != null && value !== '' ? toYmd(value) : '';
  if (ymd) {
    query[key] = ymd;
  }
}
