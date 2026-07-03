import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { EN_MONTHS } from '../../Reports/reportHelpers';
import { formatCompactNumber, formatNumber } from '../../../utils/money';
import { MONTH_NAMES_AR } from '../utils/ownerDashboardCalculations';
import type { OwnerDashboardMetric, OwnerMonthlyComparisonRow } from '../types';
import { safePercent } from '../../../shared/reporting/plDisplaySelectors';
import { Button, MatrixTable, cn } from '../../../ui';
import type { MatrixTableColumn } from '../../../ui';

const OWNER_METRIC_BUTTON_CLASSES: Record<OwnerDashboardMetric, string> = {
  sales: 'nx-owner-metric--sales',
  purchases: 'nx-owner-metric--purchases',
  expenses: 'nx-owner-metric--expenses',
  netProfit: 'nx-owner-metric--net-profit',
};

const OWNER_METRIC_DOT_CLASSES: Record<OwnerDashboardMetric, string> = {
  sales: 'nx-owner-dot--sales',
  purchases: 'nx-owner-dot--purchases',
  expenses: 'nx-owner-dot--expenses',
  netProfit: 'nx-owner-dot--net-profit',
};

const OWNER_METRIC_TEXT_CLASSES: Record<OwnerDashboardMetric, string> = {
  sales: 'nx-owner-text--sales',
  purchases: 'nx-owner-text--purchases',
  expenses: 'nx-owner-text--expenses',
  netProfit: 'nx-owner-text--net-profit',
};

type OwnerMonthlyComparisonTableProps = {
  year: number;
  comparisonMetric: OwnerDashboardMetric;
  setComparisonMetric: (m: OwnerDashboardMetric) => void;
  companyMonthlyData: OwnerMonthlyComparisonRow[];
  grandMonthlyTotals: number[];
  grandTotal: number;
};

export function OwnerMonthlyComparisonTable({
  year,
  comparisonMetric,
  setComparisonMetric,
  companyMonthlyData,
  grandMonthlyTotals,
  grandTotal,
}: OwnerMonthlyComparisonTableProps) {
  const { t, lang } = useTranslation();

  const isNetProfit = comparisonMetric === 'netProfit';
  const comparisonMetrics: { key: OwnerDashboardMetric; label: string }[] = [
    { key: 'sales', label: t('annualSales') },
    { key: 'purchases', label: t('annualPurchases') },
    { key: 'expenses', label: t('annualExpenses') },
    { key: 'netProfit', label: t('ownerTotalNetProfit') },
  ];
  const monthAbbr =
    lang === 'ar'
      ? MONTH_NAMES_AR.map((m) => m.slice(0, 3))
      : EN_MONTHS.map((m) => m.slice(0, 3));

  const valClass = (val: number) => {
    if (!isNetProfit) return undefined;
    return val < 0 ? 'text-noorix-red' : val > 0 ? 'text-noorix-green' : undefined;
  };

  const columns: MatrixTableColumn<OwnerMonthlyComparisonRow>[] = [
    {
      key: 'name',
      label: lang === 'ar' ? 'الشركة' : 'Company',
      minWidth: 144,
      align: 'start',
      headerClassName: 'text-[11px] text-noorix-muted font-semibold',
      cellClassName: 'py-2.5 px-3',
      render: (value) => (
        <span className="truncate font-semibold text-noorix-text max-w-[110px]">{String(value)}</span>
      ),
    },
    ...monthAbbr.map((month, monthIndex): MatrixTableColumn<OwnerMonthlyComparisonRow> => ({
      key: `month-${monthIndex}`,
      label: month,
      minWidth: 56,
      numeric: true,
      headerClassName: 'text-[10px] text-noorix-muted font-semibold',
      cellClassName: (row) => {
        const val = row.months[monthIndex] ?? 0;
        return cn(
          'py-2.5 px-1.5 text-end',
          valClass(val) || (val === 0 ? 'text-noorix-muted' : 'text-noorix-text'),
        );
      },
      getCellStyle: (row) => {
        const val = row.months[monthIndex] ?? 0;
        const bestMonth = Math.max(...row.months);
        return {
          fontWeight: !isNetProfit && val === bestMonth && val > 0 ? 700 : 400,
          background: !isNetProfit && val === bestMonth && val > 0 ? `${row.color}0d` : undefined,
        };
      },
      render: (_value, row) => {
        const val = row.months[monthIndex] ?? 0;
        return val === 0 ? <span className="text-[10px] opacity-30">-</span> : formatCompactNumber(val, lang);
      },
    })),
    {
      key: 'total',
      label: lang === 'ar' ? 'المجموع' : 'Total',
      minWidth: 80,
      numeric: true,
      headerClassName: 'text-[11px] text-noorix-muted font-semibold',
      cellClassName: (row) => cn(
        'py-2.5 px-3 text-end font-bold',
        valClass(row.total) || OWNER_METRIC_TEXT_CLASSES[comparisonMetric],
      ),
      render: (_value, row) => formatCompactNumber(row.total, lang),
    },
    {
      key: 'percent',
      label: '%',
      minWidth: 48,
      numeric: true,
      headerClassName: 'text-[10px] text-noorix-muted font-semibold',
      cellClassName: 'py-2.5 px-3 text-end text-[11px] text-noorix-muted',
      render: (_value, row) => {
        const pct = safePercent(row.total, grandTotal) ?? 0;
        return `${formatNumber(isNetProfit ? pct : Math.abs(pct), lang)}%`;
      },
    },
  ];

  return (
    <div className="noorix-surface-card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="text-[14px] font-bold text-noorix-text">
            {lang === 'ar' ? 'مقارنة الشركات الشهرية' : 'Monthly Company Comparison'}
          </div>
          <div className="text-[12px] text-noorix-muted mt-0.5">{year}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {comparisonMetrics.map((m) => {
            const active = comparisonMetric === m.key;
            return (
              <Button
                type="button"
                variant="raw"
                size="auto"
                key={m.key}
                onClick={() => setComparisonMetric(m.key)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded border transition-all duration-150',
                  active ? OWNER_METRIC_BUTTON_CLASSES[m.key] : 'border-noorix-border bg-transparent text-noorix-muted',
                )}
              >
                <span
                  className={cn(
                    'inline-block w-3 h-0.5 rounded-full flex-shrink-0',
                    active ? OWNER_METRIC_DOT_CLASSES[m.key] : 'bg-noorix-border',
                  )}
                />
                {m.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="-mx-5 px-5">
        <MatrixTable<OwnerMonthlyComparisonRow>
          columns={columns}
          data={companyMonthlyData}
          tableMinWidth={860}
          frameClassName="border-0 bg-transparent shadow-none"
          tableClassName="text-[12px]"
          getRowKey={(row) => row.cid}
          getRowClassName={() => 'border-b border-noorix-border/40 hover:bg-noorix-bg-muted/50'}
          getRowAccentColor={(row) => row.color}
          footer={(
            <tr className="border-t-2 border-noorix-border">
              <td className="sticky start-0 z-[2] py-3 px-3 font-bold text-noorix-text text-[12px]">
                {lang === 'ar' ? 'الإجمالي' : 'Total'}
              </td>
              {grandMonthlyTotals.map((val, monthIndex) => (
                <td key={monthIndex} className={cn('py-3 px-1.5 text-end font-bold tabular-nums', valClass(val) || 'text-noorix-text')}>
                  {val === 0 ? <span className="text-[10px] opacity-30">-</span> : formatCompactNumber(val, lang)}
                </td>
              ))}
              <td className={cn('py-3 px-3 text-end font-bold tabular-nums', valClass(grandTotal) || OWNER_METRIC_TEXT_CLASSES[comparisonMetric])}>
                {formatCompactNumber(grandTotal, lang)}
              </td>
              <td className="py-3 px-3 text-end text-[11px] text-noorix-muted">100%</td>
            </tr>
          )}
        />
      </div>
    </div>
  );
}
