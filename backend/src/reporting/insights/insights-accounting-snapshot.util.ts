import type { GeneralProfitLossModel } from '../../reports/reports-general-profit-loss-model.util';
import { parseAmount } from './insights-format.util';

export type AccountingSnapshot = {
  raw: {
    sales: string | number | null;
    purchases: string | number | null;
    expenses: string | number | null;
    grossProfit: string | number | null;
    netProfit: string | number | null;
  };
  numeric: {
    sales: number | null;
    purchases: number | null;
    expenses: number | null;
    grossProfit: number | null;
    netProfit: number | null;
  };
};

export function extractAccountingSnapshot(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
): AccountingSnapshot | null {
  if (!profitLoss || typeof profitLoss !== 'object') {
    return null;
  }
  const cards = profitLoss.cards;
  const groups = profitLoss.groups;
  const summaryRows = profitLoss.summaryRows;

  if (selectedMonth != null && selectedMonth >= 1 && selectedMonth <= 12) {
    const mi = selectedMonth - 1;
    const salesG = groups?.find((g) => g.key === 'sales');
    const purG = groups?.find((g) => g.key === 'purchases');
    const expG = groups?.find((g) => g.key === 'expenses');
    const grossR = summaryRows?.find((r) => r.key === 'grossProfit');
    const netR = summaryRows?.find((r) => r.key === 'netProfit');

    const raw = {
      sales: salesG?.months?.[mi] ?? null,
      purchases: purG?.months?.[mi] ?? null,
      expenses: expG?.months?.[mi] ?? null,
      grossProfit: grossR?.months?.[mi] ?? null,
      netProfit: netR?.months?.[mi] ?? null,
    };
    return {
      raw,
      numeric: {
        sales: parseAmount(raw.sales),
        purchases: parseAmount(raw.purchases),
        expenses: parseAmount(raw.expenses),
        grossProfit: parseAmount(raw.grossProfit),
        netProfit: parseAmount(raw.netProfit),
      },
    };
  }

  const raw = {
    sales: cards?.sales ?? null,
    purchases: cards?.purchases ?? null,
    expenses: cards?.expenses ?? null,
    grossProfit: cards?.grossProfit ?? null,
    netProfit: cards?.netProfit ?? null,
  };
  return {
    raw,
    numeric: {
      sales: parseAmount(raw.sales),
      purchases: parseAmount(raw.purchases),
      expenses: parseAmount(raw.expenses),
      grossProfit: parseAmount(raw.grossProfit),
      netProfit: parseAmount(raw.netProfit),
    },
  };
}

export type OperationalMonthRollup = {
  periodSalesFromSummaries: number | null;
  activeSalesDaysInMonth: number | null;
};

function parseYmd(dateStr: unknown): { y: number; month: number; day: number } | null {
  if (dateStr == null) return null;
  const s = String(dateStr).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Sum totals and active days from dashboard sales pack for a calendar month (operational). */
export function rollupOperationalMonth(
  salesPack: unknown,
  year: number,
  selectedMonth: number | null,
): OperationalMonthRollup {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) {
    return { periodSalesFromSummaries: null, activeSalesDaysInMonth: null };
  }
  const pack = salesPack as {
    dailySummaries?: Array<{ transactionDate?: unknown; totalAmount?: unknown }>;
    monthSummaries?: Array<{ transactionDate?: unknown; totalAmount?: unknown }>;
  } | null;

  const byDay = new Map<string, number>();

  const addRow = (transactionDate: unknown, totalAmount: unknown) => {
    const p = parseYmd(transactionDate);
    if (!p || p.y !== year || p.month !== selectedMonth) return;
    const key = `${p.y}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    const amt = parseAmount(totalAmount) ?? 0;
    byDay.set(key, (byDay.get(key) ?? 0) + amt);
  };

  const ds = pack?.dailySummaries;
  if (Array.isArray(ds)) {
    for (const row of ds) {
      addRow(row?.transactionDate, row?.totalAmount);
    }
  }

  if (byDay.size === 0 && Array.isArray(pack?.monthSummaries)) {
    for (const row of pack.monthSummaries) {
      addRow(row?.transactionDate, row?.totalAmount);
    }
  }

  let periodSales = 0;
  let activeDays = 0;
  for (const v of byDay.values()) {
    periodSales += v;
    if (v > 0) activeDays += 1;
  }

  if (byDay.size === 0) {
    return {
      periodSalesFromSummaries: 0,
      activeSalesDaysInMonth: 0,
    };
  }

  return {
    periodSalesFromSummaries: periodSales,
    activeSalesDaysInMonth: activeDays,
  };
}

export function isCalendarMonthEntirelyInFuture(year: number, month: number, ref: Date): boolean {
  const start = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  const refDay = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), 0, 0, 0, 0);
  return start > refDay;
}
