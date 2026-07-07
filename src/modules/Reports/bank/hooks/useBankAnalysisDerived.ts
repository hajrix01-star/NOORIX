import { useMemo } from 'react';
import {
  buildDailyChartData,
  buildDepositsByCategory,
  extractPosTerminals,
  topDebits,
  countPosLikeTransactions,
  type BankCategoryAgg,
} from '../bankAnalysisUtils';
import { estimateYAxisWidth, truncateLabel } from '../bankAnalysisHelpers';
import type { BarRow, BankTransactionLite, CategoryTableRow, PieDisplayMode, PieSliceRow } from '../bankAnalysisTab.types';

/**
 * اشتقاق بيانات الرسوم والجداول — نفس الحسابات السابقة.
 */
export function useBankAnalysisDerived(
  txs: readonly BankTransactionLite[],
  summaryByCategory: Record<string, BankCategoryAgg>,
  pieMode: PieDisplayMode,
  uncategorizedLabel: string,
) {
  const dailyData = useMemo(() => buildDailyChartData(txs), [txs]);
  const alerts = useMemo(() => topDebits(txs, 10), [txs]);
  const posCount = useMemo(() => countPosLikeTransactions(txs), [txs]);
  const posTerminals = useMemo(() => extractPosTerminals(txs), [txs]);
  const depositsByCategory = useMemo(
    () => buildDepositsByCategory(txs, uncategorizedLabel),
    [txs, uncategorizedLabel],
  );

  const pieDisplayData = useMemo(() => {
    const entries = Object.entries(summaryByCategory).map(([name, d]) => ({
      name,
      debit: d.totalDebit,
      credit: d.totalCredit,
      count: d.count,
    }));

    let rows: Array<{ name: string; debit: number; credit: number; count: number; value: number }>;
    if (pieMode === 'combined') {
      rows = entries
        .map((e) => ({
          ...e,
          value: Math.round((e.debit + e.credit) * 100) / 100,
        }))
        .filter((x) => x.value > 0);
    } else if (pieMode === 'debit') {
      rows = entries
        .map((e) => ({ ...e, value: Math.round(e.debit * 100) / 100 }))
        .filter((x) => x.value > 0);
    } else {
      rows = entries
        .map((e) => ({ ...e, value: Math.round(e.credit * 100) / 100 }))
        .filter((x) => x.value > 0);
    }

    rows.sort((a, b) => b.value - a.value);
    rows = rows.slice(0, 10);
    const sliceTotal = rows.reduce((s, x) => s + x.value, 0);
    const withPct: PieSliceRow[] = rows.map((x) => ({
      ...x,
      percent: sliceTotal > 0 ? ((x.value / sliceTotal) * 100).toFixed(1) : '0',
    }));
    return withPct;
  }, [summaryByCategory, pieMode]);

  const pieGrandTotals = useMemo(() => {
    const entries = Object.values(summaryByCategory);
    const totalDebit = entries.reduce((s, d) => s + d.totalDebit, 0);
    const totalCredit = entries.reduce((s, d) => s + d.totalCredit, 0);
    return {
      totalDebit,
      totalCredit,
      totalVolume: totalDebit + totalCredit,
    };
  }, [summaryByCategory]);

  const barRowsDebit = useMemo(
    () =>
      Object.entries(summaryByCategory)
        .map(([name, d]) => ({
          fullName: name,
          name: truncateLabel(name, 26),
          value: Math.round(d.totalDebit),
        }))
        .filter((x) => x.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8) as BarRow[],
    [summaryByCategory],
  );

  const barRowsCredit = useMemo(
    () =>
      Object.entries(summaryByCategory)
        .map(([name, d]) => ({
          fullName: name,
          name: truncateLabel(name, 26),
          value: Math.round(d.totalCredit),
        }))
        .filter((x) => x.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8) as BarRow[],
    [summaryByCategory],
  );

  const barDebitAxisW = useMemo(
    () => estimateYAxisWidth(barRowsDebit.map((r) => r.name)),
    [barRowsDebit],
  );
  const barCreditAxisW = useMemo(
    () => estimateYAxisWidth(barRowsCredit.map((r) => r.name)),
    [barRowsCredit],
  );

  const categoryRows = useMemo(() => {
    const totalDebit = Object.values(summaryByCategory).reduce((s, d) => s + d.totalDebit, 0);
    const totalCredit = Object.values(summaryByCategory).reduce((s, d) => s + d.totalCredit, 0);
    return Object.entries(summaryByCategory)
      .map(([name, d]) => ({
        name,
        count: d.count,
        debit: d.totalDebit,
        credit: d.totalCredit,
        debitPct: totalDebit > 0 ? (d.totalDebit / totalDebit) * 100 : 0,
        creditPct: totalCredit > 0 ? (d.totalCredit / totalCredit) * 100 : 0,
      }))
      .sort((a, b) => b.debit - a.debit) as CategoryTableRow[];
  }, [summaryByCategory]);

  const totalDebit = useMemo(
    () => categoryRows.reduce((s, r) => s + r.debit, 0),
    [categoryRows],
  );
  const totalCredit = useMemo(
    () => categoryRows.reduce((s, r) => s + r.credit, 0),
    [categoryRows],
  );

  return {
    dailyData,
    alerts,
    posCount,
    posTerminals,
    depositsByCategory,
    pieDisplayData,
    pieGrandTotals,
    barRowsDebit,
    barRowsCredit,
    barDebitAxisW,
    barCreditAxisW,
    categoryRows,
    totalDebit,
    totalCredit,
  };
}
