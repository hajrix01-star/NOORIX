/**
 * مقارنة KPI بالفترة السابقة: شهر ↔ شهر سابق في نفس السنة، أو سنة ↔ سنة سابقة.
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { cn } from '../../../ui';
import { amountText } from '../../Reports/reportHelpers';
import { getCardValue, type PlReportLike } from '../overview/utils/dashboardOverviewCalculations';
import { MONTH_NAMES_AR, MONTH_NAMES_EN } from '../overview/hooks/useDashboardOverviewModel';

const COMPARE_KEYS = ['sales', 'purchases', 'expenses', 'grossProfit', 'netProfit'] as const;

function pctChange(curr: number, prev: number): string {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return '—';
  if (Math.abs(prev) < 1e-9) return '—';
  const p = ((curr - prev) / Math.abs(prev)) * 100;
  if (!Number.isFinite(p)) return '—';
  const rounded = Math.round(p * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

type Props = {
  show: boolean;
  year: number;
  selectedMonth: number | null;
  currentReport: PlReportLike | null | undefined;
  prevYearReport: PlReportLike | null | undefined;
  prevYearLoading: boolean;
  className?: string;
};

export function DashboardStudioCompareBlock({
  show,
  year,
  selectedMonth,
  currentReport,
  prevYearReport,
  prevYearLoading,
  className,
}: Props) {
  const { t, lang } = useTranslation();
  const isAr = lang === 'ar';

  const { prevLabel, rows } = useMemo(() => {
    if (!show || !currentReport) {
      return { prevLabel: '', rows: [] as { key: string; label: string; cur: number; prev: number }[] };
    }

    if (selectedMonth != null) {
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevLabelLocal = isAr
        ? `${MONTH_NAMES_AR[prevMonth - 1]} ${year}`
        : `${MONTH_NAMES_EN[prevMonth - 1]} ${year}`;
      const r = COMPARE_KEYS.map((key) => ({
        key,
        label:
          key === 'sales'
            ? t('annualSales')
            : key === 'purchases'
              ? t('annualPurchases')
              : key === 'expenses'
                ? t('annualExpenses')
                : key === 'grossProfit'
                  ? t('annualGrossProfit')
                  : t('annualNetProfit'),
        cur: Number(getCardValue(currentReport, key, selectedMonth) || 0),
        prev: Number(getCardValue(currentReport, key, prevMonth) || 0),
      }));
      return { prevLabel: prevLabelLocal, rows: r };
    }

    const prevLabelLocal = String(year - 1);
    const r = COMPARE_KEYS.map((key) => ({
      key,
      label:
        key === 'sales'
          ? t('annualSales')
          : key === 'purchases'
            ? t('annualPurchases')
            : key === 'expenses'
              ? t('annualExpenses')
              : key === 'grossProfit'
                ? t('annualGrossProfit')
                : t('annualNetProfit'),
      cur: Number(getCardValue(currentReport, key, null) || 0),
      prev: Number(getCardValue(prevYearReport ?? null, key, null) || 0),
    }));
    return { prevLabel: prevLabelLocal, rows: r };
  }, [show, currentReport, selectedMonth, year, isAr, t, prevYearReport]);

  if (!show) return null;

  const canShowTable =
    rows.length > 0 && (selectedMonth != null || (!prevYearLoading && prevYearReport != null));

  return (
    <div className={cn('noorix-surface-card rounded-xl border border-noorix-border p-4 shadow-sm', className)}>
      <div className="text-[14px] font-bold text-noorix-text">{t('dashboardStudioCompareTitle')}</div>
      <p className="mt-1 text-[12px] text-noorix-muted m-0">{t('dashboardStudioCompareHint')}</p>

      {selectedMonth == null && prevYearLoading ? (
        <div className="mt-3 text-[13px] text-noorix-muted">{t('loading')}</div>
      ) : null}

      {selectedMonth == null && !prevYearLoading && !prevYearReport ? (
        <div className="mt-3 text-[12px] text-noorix-muted">{t('dashboardStudioCompareNoPrevYear')}</div>
      ) : null}

      {canShowTable ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] text-[12px]">
            <thead>
              <tr className="border-b border-noorix-border text-noorix-muted">
                <th className="py-2 pe-2 text-start font-medium">{t('dashboardStudioCsvMetric')}</th>
                <th className="py-2 pe-2 text-end font-medium ltr" dir="ltr">
                  {t('dashboardStudioCompareCurrent')}
                </th>
                <th className="py-2 pe-2 text-end font-medium ltr" dir="ltr">
                  {t('dashboardStudioComparePrevious')} ({prevLabel})
                </th>
                <th className="py-2 text-end font-medium">{t('dashboardStudioCompareDelta')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-noorix-border/60">
                  <td className="py-2 pe-2 font-medium text-noorix-text">{row.label}</td>
                  <td className="py-2 pe-2 text-end nx-font-numbers ltr" dir="ltr">
                    {amountText(String(row.cur))} <span className="nx-sar">SR</span>
                  </td>
                  <td className="py-2 pe-2 text-end nx-font-numbers ltr" dir="ltr">
                    {amountText(String(row.prev))} <span className="nx-sar">SR</span>
                  </td>
                  <td
                    className={cn(
                      'py-2 text-end font-semibold nx-font-numbers',
                      row.cur > row.prev ? 'text-noorix-green' : row.cur < row.prev ? 'text-noorix-red' : 'text-noorix-muted',
                    )}
                  >
                    {pctChange(row.cur, row.prev)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
