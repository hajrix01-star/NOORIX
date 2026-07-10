import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { EN_MONTHS } from '../../Reports/reportHelpers';
import { formatCompactNumber, formatNumber } from '../../../utils/money';
import { MONTH_NAMES_AR } from '../utils/ownerDashboardDisplay';
import type { OwnerOverviewComparison, OwnerOverviewComparisonRow, OwnerOverviewMetric } from '../types';
import { Button, MatrixTable, cn } from '../../../ui';
import type { MatrixTableColumn } from '../../../ui';
import { SERIES_RECHARTS_COLORS } from '../../../constants/kpiCardTheme';

const OWNER_METRIC_BUTTON_CLASSES: Record<OwnerOverviewMetric, string> = {
  sales: 'nx-owner-metric--sales',
  purchases: 'nx-owner-metric--purchases',
  expenses: 'nx-owner-metric--expenses',
  netProfit: 'nx-owner-metric--net-profit',
};

const OWNER_METRIC_DOT_CLASSES: Record<OwnerOverviewMetric, string> = {
  sales: 'nx-owner-dot--sales',
  purchases: 'nx-owner-dot--purchases',
  expenses: 'nx-owner-dot--expenses',
  netProfit: 'nx-owner-dot--net-profit',
};

const OWNER_METRIC_TEXT_CLASSES: Record<OwnerOverviewMetric, string> = {
  sales: 'nx-owner-text--sales',
  purchases: 'nx-owner-text--purchases',
  expenses: 'nx-owner-text--expenses',
  netProfit: 'nx-owner-text--net-profit',
};

type OwnerMonthlyComparisonTableProps = {
  year: number;
  comparisonMetric: OwnerOverviewMetric;
  setComparisonMetric: (metric: OwnerOverviewMetric) => void;
  comparison: OwnerOverviewComparison;
};

export function OwnerMonthlyComparisonTable({
  year,
  comparisonMetric,
  setComparisonMetric,
  comparison,
}: OwnerMonthlyComparisonTableProps) {
  const { t, lang } = useTranslation();
  const isNetProfit = comparisonMetric === 'netProfit';
  const comparisonMetrics: { key: OwnerOverviewMetric; label: string }[] = [
    { key: 'sales', label: t('annualSales') },
    { key: 'purchases', label: t('annualPurchases') },
    { key: 'expenses', label: t('annualExpenses') },
    { key: 'netProfit', label: t('ownerTotalNetProfit') },
  ];
  const monthAbbr =
    lang === 'ar'
      ? MONTH_NAMES_AR.map((month) => month.slice(0, 3))
      : EN_MONTHS.map((month) => month.slice(0, 3));

  const valClass = (value: number) => {
    if (!isNetProfit) return undefined;
    return value < 0 ? 'text-noorix-red' : value > 0 ? 'text-noorix-green' : undefined;
  };

  const columns: MatrixTableColumn<OwnerOverviewComparisonRow>[] = [
    {
      key: 'nameAr',
      label: lang === 'ar' ? 'الشركة' : 'Company',
      minWidth: 144,
      align: 'start',
      headerClassName: 'text-[11px] text-noorix-muted font-semibold',
      cellClassName: 'py-2.5 px-3',
      render: (_value, row) => {
        const name = lang === 'ar' ? row.nameAr || row.nameEn : row.nameEn || row.nameAr;
        return <span className="truncate font-semibold text-noorix-text max-w-[110px]">{name}</span>;
      },
    },
    ...monthAbbr.map((month, monthIndex): MatrixTableColumn<OwnerOverviewComparisonRow> => ({
      key: `month-${monthIndex}`,
      label: month,
      minWidth: 56,
      numeric: true,
      headerClassName: 'text-[10px] text-noorix-muted font-semibold',
      cellClassName: (row) => {
        const value = row.months[monthIndex] ?? 0;
        return cn(
          'py-2.5 px-1.5 text-end',
          valClass(value) || (value === 0 ? 'text-noorix-muted' : 'text-noorix-text'),
        );
      },
      render: (_value, row) => {
        const value = row.months[monthIndex] ?? 0;
        return value === 0 ? <span className="text-[10px] opacity-30">-</span> : formatCompactNumber(value, lang);
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
      key: 'shareOfGrandTotalPct',
      label: '%',
      minWidth: 48,
      numeric: true,
      headerClassName: 'text-[10px] text-noorix-muted font-semibold',
      cellClassName: 'py-2.5 px-3 text-end text-[11px] text-noorix-muted',
      render: (_value, row) =>
        row.shareOfGrandTotalPct == null ? '-' : `${formatNumber(row.shareOfGrandTotalPct, lang)}%`,
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
          {comparisonMetrics.map((metric) => {
            const active = comparisonMetric === metric.key;
            return (
              <Button
                type="button"
                variant="raw"
                size="auto"
                key={metric.key}
                onClick={() => setComparisonMetric(metric.key)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded border transition-all duration-150',
                  active ? OWNER_METRIC_BUTTON_CLASSES[metric.key] : 'border-noorix-border bg-transparent text-noorix-muted',
                )}
              >
                <span
                  className={cn(
                    'inline-block w-3 h-0.5 rounded-full flex-shrink-0',
                    active ? OWNER_METRIC_DOT_CLASSES[metric.key] : 'bg-noorix-border',
                  )}
                />
                {metric.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="-mx-5 px-5">
        <MatrixTable<OwnerOverviewComparisonRow>
          columns={columns}
          data={comparison.rows}
          tableMinWidth={860}
          frameClassName="border-0 bg-transparent shadow-none"
          tableClassName="text-[12px]"
          getRowKey={(row) => row.companyId}
          getRowClassName={() => 'border-b border-noorix-border/40 hover:bg-noorix-bg-muted/50'}
          getRowAccentColor={(row) => SERIES_RECHARTS_COLORS[row.colorIndex % SERIES_RECHARTS_COLORS.length]}
          footer={(
            <tr className="border-t-2 border-noorix-border">
              <td className="sticky start-0 z-[2] py-3 px-3 font-bold text-noorix-text text-[12px]">
                {lang === 'ar' ? 'الإجمالي' : 'Total'}
              </td>
              {comparison.grandMonthlyTotals.map((value, monthIndex) => (
                <td key={monthIndex} className={cn('py-3 px-1.5 text-end font-bold tabular-nums', valClass(value) || 'text-noorix-text')}>
                  {value === 0 ? <span className="text-[10px] opacity-30">-</span> : formatCompactNumber(value, lang)}
                </td>
              ))}
              <td className={cn('py-3 px-3 text-end font-bold tabular-nums', valClass(comparison.grandTotal) || OWNER_METRIC_TEXT_CLASSES[comparisonMetric])}>
                {formatCompactNumber(comparison.grandTotal, lang)}
              </td>
              <td className="py-3 px-3 text-end text-[11px] text-noorix-muted">100%</td>
            </tr>
          )}
        />
      </div>
    </div>
  );
}
