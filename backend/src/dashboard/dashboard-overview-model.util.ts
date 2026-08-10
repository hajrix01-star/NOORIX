import { clampSalesSummaryDateQuery } from '../common/utils/sales-summary-date-range';
import { toYmd } from '../common/utils/to-ymd.util';

export const EMPTY_SALES_PACK = {
  yearSummaries: [],
  dailySummaries: [],
  monthSummaries: [],
  metrics: {
    yearDaily: [],
    yearChannels: [],
    dailyDaily: [],
    dailyTotals: [],
    dailyChannels: [],
    channelBreakdown: [],
    monthDaily: [],
    monthAverage: null,
    weekdayAverages: [],
    dailyWeekly: [],
    dailyWeeklyComparison: [],
    shiftTotals: [],
    yearMonthlyDailyAverages: [],
    appSales: {
      year: null,
      totals: [],
      monthlyRows: [],
      yearAverage: null,
      selectedMonthAverage: null,
      selectedMonthAppShare: null,
      previousMonthAverage: null,
      selectedMonth: null,
    },
  },
} as const;

export type DashboardDailyMetricRow = {
  transactionDate: string;
  totalAmount: string | number;
  customerCount: number;
};

export type DashboardProfitLossGroup = {
  key?: string;
  months?: Array<string | number | null | undefined>;
};

export type DashboardProfitLossReport = {
  cards?: Record<string, string | number | null | undefined>;
  summaryRows?: DashboardProfitLossGroup[];
  groups?: DashboardProfitLossGroup[];
};

export type DashboardTimelineRow = {
  label: string;
  sales: number;
  purchases: number;
  expenses: number;
  customers: number;
  avgInvoice: number;
};

export function percentChangeNullable(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || Math.abs(previous) <= 1e-9) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type DashboardKpiCardMetric = {
  key: string;
  value: number;
  pct: number | null;
  tone: 'positive' | 'negative' | 'neutral' | 'cost';
};
export type DashboardOperatingLedgerTotals = {
  sales: string | number;
  purchases: string | number;
  recurringExpenses: string | number;
  otherExpenses: string | number;
  payroll: string | number;
  operatingCosts: string | number;
  operatingResult: string | number;
  taxCollected?: string | number;
};

export type DashboardPeriodData = {
  totalsByKind?: Record<string, { totalAmount?: string | number | null }>;
} | null;

export type DashboardOverviewRangesInput = {
  yearStart: string;
  yearEnd: string;
  dailyStart?: string | null;
  dailyEnd?: string | null;
  monthStart?: string | null;
  monthEnd?: string | null;
  weeklyYearStart?: string | null;
  weeklyYearEnd?: string | null;
  weeklyStart?: string | null;
  weeklyEnd?: string | null;
  weeklyBaselineStart?: string | null;
  weeklyBaselineEnd?: string | null;
  previousMonthYearStart?: string | null;
  previousMonthYearEnd?: string | null;
  previousMonthStart?: string | null;
  previousMonthEnd?: string | null;
};

export type DashboardOverviewRanges = {
  ys: string;
  ye: string;
  ds: string | null;
  de: string | null;
  ms: string | null;
  me: string | null;
  wys: string;
  wye: string;
  ws: string | null;
  we: string | null;
  wbs: string | null;
  wbe: string | null;
  pmys: string;
  pmye: string;
  pms: string | null;
  pme: string | null;
};

export function buildDashboardOverviewRanges(
  input: DashboardOverviewRangesInput,
  fullHist: boolean,
): DashboardOverviewRanges {
  let ys = toYmd(input.yearStart);
  let ye = toYmd(input.yearEnd);
  let ds = input.dailyStart ? toYmd(input.dailyStart) : null;
  let de = input.dailyEnd ? toYmd(input.dailyEnd) : null;
  let ms = input.monthStart ? toYmd(input.monthStart) : null;
  let me = input.monthEnd ? toYmd(input.monthEnd) : null;
  let wys = input.weeklyYearStart ? toYmd(input.weeklyYearStart) : ys;
  let wye = input.weeklyYearEnd ? toYmd(input.weeklyYearEnd) : ye;
  let ws = input.weeklyStart ? toYmd(input.weeklyStart) : null;
  let we = input.weeklyEnd ? toYmd(input.weeklyEnd) : null;
  let wbs = input.weeklyBaselineStart ? toYmd(input.weeklyBaselineStart) : null;
  let wbe = input.weeklyBaselineEnd ? toYmd(input.weeklyBaselineEnd) : null;
  let pmys = input.previousMonthYearStart ? toYmd(input.previousMonthYearStart) : ys;
  let pmye = input.previousMonthYearEnd ? toYmd(input.previousMonthYearEnd) : ye;
  let pms = input.previousMonthStart ? toYmd(input.previousMonthStart) : null;
  let pme = input.previousMonthEnd ? toYmd(input.previousMonthEnd) : null;

  if (!fullHist) {
    const cy = clampSalesSummaryDateQuery(ys, ye, 7);
    ys = cy.startDate;
    ye = cy.endDate;
    if (ds && de) {
      const cd = clampSalesSummaryDateQuery(ds, de, 7);
      ds = cd.startDate;
      de = cd.endDate;
    }
    if (ms && me) {
      const cm = clampSalesSummaryDateQuery(ms, me, 7);
      ms = cm.startDate;
      me = cm.endDate;
    }
    const cwy = clampSalesSummaryDateQuery(wys, wye, 7);
    wys = cwy.startDate;
    wye = cwy.endDate;
    if (ws && we) {
      const cw = clampSalesSummaryDateQuery(ws, we, 7);
      ws = cw.startDate;
      we = cw.endDate;
    }
    if (wbs && wbe) {
      const cwb = clampSalesSummaryDateQuery(wbs, wbe, 7);
      wbs = cwb.startDate;
      wbe = cwb.endDate;
    }
    const cpmy = clampSalesSummaryDateQuery(pmys, pmye, 7);
    pmys = cpmy.startDate;
    pmye = cpmy.endDate;
    if (pms && pme) {
      const cpm = clampSalesSummaryDateQuery(pms, pme, 7);
      pms = cpm.startDate;
      pme = cpm.endDate;
    }
  }

  return { ys, ye, ds, de, ms, me, wys, wye, ws, we, wbs, wbe, pmys, pmye, pms, pme };
}

function monthNumberFromYmd(value: string): number | null {
  const ymd = toYmd(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const month = Number(ymd.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

function dayNumberFromYmd(value: string): number | null {
  const ymd = toYmd(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const day = Number(ymd.slice(8, 10));
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

function inclusiveDayRange(startDate: string | null, endDate: string | null): number[] {
  if (!startDate || !endDate) return [];
  const start = toYmd(startDate);
  const end = toYmd(endDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return [];
  if (start.slice(0, 7) !== end.slice(0, 7)) return [];
  const startDay = dayNumberFromYmd(start);
  const endDay = dayNumberFromYmd(end);
  if (startDay == null || endDay == null || endDay < startDay) return [];
  return Array.from({ length: endDay - startDay + 1 }, (_, index) => startDay + index);
}

function reportMonthValue(
  report: DashboardProfitLossReport | null,
  key: string,
  monthIndex: number,
): number {
  return Number(report?.groups?.find((row) => row.key === key)?.months?.[monthIndex] || 0);
}

function reportCardValue(
  report: DashboardProfitLossReport | null,
  key: string,
  selectedMonth: number | null,
): number {
  if (!report) return 0;
  if (selectedMonth == null) return Number(report.cards?.[key] || 0);
  if (key === 'grossProfit' || key === 'netProfit') {
    return Number(report.summaryRows?.find((row) => row.key === key)?.months?.[selectedMonth - 1] || 0);
  }
  return Number(report.groups?.find((row) => row.key === key)?.months?.[selectedMonth - 1] || 0);
}

function periodKindTotal(
  periodData: DashboardPeriodData,
  kinds: readonly string[],
): number {
  return kinds.reduce((sum, kind) => sum + Number(periodData?.totalsByKind?.[kind]?.totalAmount || 0), 0);
}

function sumDailyMetric(rows: readonly DashboardDailyMetricRow[], metric: 'totalAmount' | 'customerCount'): number {
  return rows.reduce((sum, row) => sum + Number(row[metric] || 0), 0);
}

function pctOfSales(key: string, value: number, sales: number): number | null {
  if (!Number.isFinite(sales) || Math.abs(sales) <= 1e-9) return null;
  if (key === 'sales') return sales > 0 ? 100 : null;
  return (value / sales) * 100;
}

function kpiTone(key: string, pct: number | null): DashboardKpiCardMetric['tone'] {
  if (pct == null || key === 'sales') return 'neutral';
  if (key === 'purchases' || key === 'expenses' || key === 'outflow') return 'cost';
  if (pct > 0) return 'positive';
  if (pct < 0) return 'negative';
  return 'neutral';
}

/**
 * Builds the overview operating cards from the classified accounting ledger.
 * The sales card keeps its existing VAT-inclusive contract; the underlying
 * projection still exposes collected tax separately for reconciliation.
 */
export function buildLedgerKpiCards(ledger: DashboardOperatingLedgerTotals): DashboardKpiCardMetric[] {
  const sales = Number(ledger.sales || 0) + Number(ledger.taxCollected || 0);
  const purchases = Number(ledger.purchases || 0);
  const expenses = Number(ledger.recurringExpenses || 0)
    + Number(ledger.otherExpenses || 0)
    + Number(ledger.payroll || 0);
  const outflow = Number(ledger.operatingCosts || 0);
  const grossProfit = sales - purchases;
  const netProfit = sales - outflow;
  const values = { sales, purchases, expenses, outflow, grossProfit, netProfit };

  return (['sales', 'purchases', 'expenses', 'outflow', 'grossProfit', 'netProfit'] as const).map((key) => {
    const value = values[key];
    const pct = pctOfSales(key, value, sales);
    return { key, value, pct, tone: kpiTone(key, pct) };
  });
}
export function buildKpiCards(params: {
  report: DashboardProfitLossReport | null;
  periodData: DashboardPeriodData;
  dailyRows: readonly DashboardDailyMetricRow[];
  selectedMonth: number | null;
  isCustomRange: boolean;
}): DashboardKpiCardMetric[] {
  const { report, periodData, dailyRows, selectedMonth, isCustomRange } = params;
  const values = isCustomRange
    ? (() => {
        const sales = sumDailyMetric(dailyRows, 'totalAmount');
        const purchases = periodKindTotal(periodData, ['purchase']);
        const expenses = periodKindTotal(periodData, ['expense', 'fixed_expense', 'hr_expense', 'salary']);
        const grossProfit = sales - purchases;
        const netProfit = grossProfit - expenses;
        const outflow = purchases + expenses;
        return { sales, purchases, grossProfit, expenses, netProfit, outflow };
      })()
    : {
        sales: reportCardValue(report, 'sales', selectedMonth),
        purchases: reportCardValue(report, 'purchases', selectedMonth),
        grossProfit: reportCardValue(report, 'grossProfit', selectedMonth),
        expenses: reportCardValue(report, 'expenses', selectedMonth),
        netProfit: reportCardValue(report, 'netProfit', selectedMonth),
        outflow:
          reportCardValue(report, 'purchases', selectedMonth) +
          reportCardValue(report, 'expenses', selectedMonth),
      };

  return (['sales', 'purchases', 'expenses', 'outflow', 'grossProfit', 'netProfit'] as const).map((key) => {
    const value = values[key];
    const pct = pctOfSales(key, value, values.sales);
    return { key, value, pct, tone: kpiTone(key, pct) };
  });
}

export function buildDashboardTimelineMonthlyRows(
  report: DashboardProfitLossReport | null,
  yearDaily: readonly DashboardDailyMetricRow[],
): DashboardTimelineRow[] {
  const customersByMonth = new Map<number, number>();
  for (const row of yearDaily) {
    const month = monthNumberFromYmd(String(row.transactionDate));
    if (month == null) continue;
    customersByMonth.set(month, (customersByMonth.get(month) ?? 0) + Number(row.customerCount || 0));
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const sales = reportMonthValue(report, 'sales', index);
    const customers = customersByMonth.get(month) ?? 0;
    return {
      label: String(month),
      sales,
      purchases: reportMonthValue(report, 'purchases', index),
      expenses: reportMonthValue(report, 'expenses', index),
      customers,
      avgInvoice: customers > 0 ? sales / customers : 0,
    };
  });
}

export function buildDashboardTimelineDailyRows(
  dailyRows: readonly DashboardDailyMetricRow[],
  startDate: string | null,
  endDate: string | null,
): DashboardTimelineRow[] {
  const byDay = new Map<number, { sales: number; customers: number }>();
  for (const row of dailyRows) {
    const day = dayNumberFromYmd(String(row.transactionDate));
    if (day == null) continue;
    const current = byDay.get(day) ?? { sales: 0, customers: 0 };
    current.sales += Number(row.totalAmount || 0);
    current.customers += Number(row.customerCount || 0);
    byDay.set(day, current);
  }

  return inclusiveDayRange(startDate, endDate).map((day) => {
    const current = byDay.get(day) ?? { sales: 0, customers: 0 };
    return {
      label: String(day),
      sales: current.sales,
      purchases: 0,
      expenses: 0,
      customers: current.customers,
      avgInvoice: current.customers > 0 ? current.sales / current.customers : 0,
    };
  });
}
