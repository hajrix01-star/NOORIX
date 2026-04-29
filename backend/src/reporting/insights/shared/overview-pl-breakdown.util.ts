import type { GeneralProfitLossModel } from '../../../reports/reports-general-profit-loss-model.util';
import { INSIGHT_THRESHOLDS } from '../insights.thresholds';
import { parseAmount } from '../insights.rules';
import { formatReportMoneyInteger } from '../../../common/utils/report-display-format.util';
import { flattenPlGroupItems } from './pl-group-flatten.util';

const EPS = INSIGHT_THRESHOLDS.salesEpsilon;

export type OverviewPlBreakdownRow = {
  key: string;
  labelAr: string;
  labelEn: string;
  /** Raw month cell when available; otherwise a derived decimal string */
  amountDisplay: string;
  /** Share of group total for the selected month (0–1), null if denominator missing */
  shareOfGroupTotal: number | null;
};

function monthCell(row: { months?: string[] } | undefined, mi: number): string | null {
  const m = row?.months;
  if (!m || mi < 0 || mi > 11) return null;
  const s = m[mi];
  return s != null && String(s).trim() !== '' ? String(s) : null;
}

/**
 * Top expense `category:` rows for a calendar month plus optional uncategorized (`kind:` / `account:`) aggregate.
 * Read-only over existing P&L strings; does not alter ledger math.
 */
export function buildExpenseCategoryBreakdownForMonth(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
  maxRows: number,
): OverviewPlBreakdownRow[] | undefined {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return undefined;
  const mi = selectedMonth - 1;
  const expG = profitLoss?.groups?.find((g) => g.key === 'expenses');
  const totalExpenses = parseAmount(expG?.months?.[mi]);
  if (totalExpenses == null || !Number.isFinite(totalExpenses) || totalExpenses <= EPS) return undefined;

  const flatRows = flattenPlGroupItems(expG?.items as Parameters<typeof flattenPlGroupItems>[0]) as Array<{
    key: string;
    labelAr: string;
    labelEn: string;
    months: string[];
  }>;

  const categorized: OverviewPlBreakdownRow[] = [];
  let uncAmt = 0;
  for (const r of flatRows) {
    const a = parseAmount(r.months[mi]);
    const amt = a != null && Number.isFinite(a) ? a : 0;
    if (amt <= EPS) continue;
    if (r.key.startsWith('category:')) {
      const cell = monthCell(r, mi);
      categorized.push({
        key: r.key,
        labelAr: r.labelAr,
        labelEn: r.labelEn,
        amountDisplay: formatReportMoneyInteger(cell != null ? parseAmount(cell) ?? amt : amt),
        shareOfGroupTotal: amt / totalExpenses,
      });
    } else if (r.key.startsWith('kind:') || r.key.startsWith('account:')) {
      uncAmt += amt;
    }
  }

  const uncRow: OverviewPlBreakdownRow | null =
    uncAmt > EPS
      ? {
          key: 'uncategorized:expense',
          labelAr: 'غير مصنّف',
          labelEn: 'Uncategorized',
          amountDisplay: formatReportMoneyInteger(uncAmt),
          shareOfGroupTotal: uncAmt / totalExpenses,
        }
      : null;

  const merged = [...categorized, ...(uncRow ? [uncRow] : [])].sort((a, b) => {
    const pa = parseAmount(a.amountDisplay) ?? 0;
    const pb = parseAmount(b.amountDisplay) ?? 0;
    return pb - pa;
  });

  if (merged.length === 0) return undefined;
  return merged.slice(0, maxRows);
}

/**
 * Sales sub-rows for a calendar month from the P&L `sales` group (channels, kinds, categories).
 */
export function buildSalesBreakdownForMonth(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
  maxRows: number,
): OverviewPlBreakdownRow[] | undefined {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return undefined;
  const mi = selectedMonth - 1;
  const salesG = profitLoss?.groups?.find((g) => g.key === 'sales');
  const totalSales = parseAmount(salesG?.months?.[mi]);
  if (totalSales == null || !Number.isFinite(totalSales) || totalSales <= EPS) return undefined;

  const flatRows = flattenPlGroupItems(salesG?.items as Parameters<typeof flattenPlGroupItems>[0]) as Array<{
    key: string;
    labelAr: string;
    labelEn: string;
    months: string[];
  }>;

  const byKey = new Map<string, { labelAr: string; labelEn: string; amount: number; display: string }>();
  for (const r of flatRows) {
    const a = parseAmount(r.months[mi]);
    const amt = a != null && Number.isFinite(a) ? a : 0;
    if (amt <= EPS) continue;
    const cell = monthCell(r, mi);
    const prev = byKey.get(r.key);
    if (prev) {
      const nextAmt = prev.amount + amt;
      byKey.set(r.key, {
        labelAr: r.labelAr,
        labelEn: r.labelEn,
        amount: nextAmt,
        display: formatReportMoneyInteger(nextAmt),
      });
    } else {
      byKey.set(r.key, {
        labelAr: r.labelAr,
        labelEn: r.labelEn,
        amount: amt,
        display: formatReportMoneyInteger(cell != null ? parseAmount(cell) ?? amt : amt),
      });
    }
  }

  const rows: OverviewPlBreakdownRow[] = [...byKey.entries()].map(([key, v]) => ({
    key,
    labelAr: v.labelAr,
    labelEn: v.labelEn,
    amountDisplay: v.display,
    shareOfGroupTotal: v.amount / totalSales,
  }));
  rows.sort((a, b) => (parseAmount(b.amountDisplay) ?? 0) - (parseAmount(a.amountDisplay) ?? 0));
  if (rows.length === 0) return undefined;
  return rows.slice(0, maxRows);
}
