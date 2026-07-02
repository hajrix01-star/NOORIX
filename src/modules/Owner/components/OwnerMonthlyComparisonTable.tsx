import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { KPI_RECHARTS_COLORS } from '../../../constants/kpiCardTheme';
import { EN_MONTHS } from '../../Reports/reportHelpers';
import { formatCompactNumber, formatNumber } from '../../../utils/money';
import { MONTH_NAMES_AR } from '../utils/ownerDashboardCalculations';
import type { OwnerDashboardMetric, OwnerMonthlyComparisonRow } from '../types';
import { safePercent } from '../../../shared/reporting/plDisplaySelectors';
import { Button } from '../../../ui';

const METRIC_COLORS = {
  sales: KPI_RECHARTS_COLORS.sales,
  purchases: KPI_RECHARTS_COLORS.purchases,
  expenses: KPI_RECHARTS_COLORS.expenses,
  netProfit: KPI_RECHARTS_COLORS.netProfit,
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
  const metricColor = METRIC_COLORS[comparisonMetric];
  const COMPARISON_METRICS: { key: OwnerDashboardMetric; label: string }[] = [
    { key: 'sales', label: t('annualSales') },
    { key: 'purchases', label: t('annualPurchases') },
    { key: 'expenses', label: t('annualExpenses') },
    { key: 'netProfit', label: t('ownerTotalNetProfit') },
  ];
  const monthAbbr =
    lang === 'ar'
      ? MONTH_NAMES_AR.map((m) => m.slice(0, 3))
      : EN_MONTHS.map((m) => m.slice(0, 3));

  const valColor = (val: number) => {
    if (!isNetProfit) return undefined;
    return val < 0 ? 'var(--noorix-accent-red)' : val > 0 ? 'var(--noorix-accent-green)' : undefined;
  };

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
          {COMPARISON_METRICS.map((m) => {
            const active = comparisonMetric === m.key;
            const color = METRIC_COLORS[m.key];
            return (
              <Button
                type="button"
                variant="raw"
                size="auto"
                key={m.key}
                onClick={() => setComparisonMetric(m.key)}
                style={{
                  borderColor: active ? color : 'var(--noorix-border)',
                  color: active ? color : 'var(--noorix-text-muted)',
                  background: active ? `${color}14` : 'transparent',
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded border transition-all duration-150"
              >
                <span
                  className="inline-block w-3 h-0.5 rounded-full flex-shrink-0"
                  style={{ background: active ? color : 'var(--noorix-border)' }}
                />
                {m.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        <table style={{ minWidth: 860 }} className="w-full text-[12px] border-collapse">
          <thead>
            <tr>
              <th className="text-start py-2 px-3 text-[11px] text-noorix-muted font-semibold w-36 border-b border-noorix-border">
                {lang === 'ar' ? 'الشركة' : 'Company'}
              </th>
              {monthAbbr.map((m, i) => (
                <th
                  key={i}
                  className="text-end py-2 px-1.5 text-[10px] text-noorix-muted font-semibold min-w-[56px] border-b border-noorix-border"
                >
                  {m}
                </th>
              ))}
              <th className="text-end py-2 px-3 text-[11px] text-noorix-muted font-semibold min-w-[80px] border-b-2 border-noorix-border">
                {lang === 'ar' ? 'المجموع' : 'Total'}
              </th>
              <th className="text-end py-2 px-3 text-[10px] text-noorix-muted font-semibold min-w-[48px] border-b-2 border-noorix-border">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {companyMonthlyData.map(({ cid, name, months, total, color }) => {
              const pct = safePercent(total, grandTotal) ?? 0;
              const bestMonth = Math.max(...months);
              return (
                <tr key={cid} className="border-b border-noorix-border/40 hover:bg-noorix-bg-muted/50 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                      <span className="font-semibold text-noorix-text truncate max-w-[110px]">{name}</span>
                    </div>
                  </td>
                  {months.map((val, mi) => (
                    <td
                      key={mi}
                      className="py-2.5 px-1.5 text-end tabular-nums"
                      style={{
                        color: valColor(val) || (val === 0 ? 'var(--noorix-text-muted)' : 'var(--noorix-text)'),
                        fontWeight: !isNetProfit && val === bestMonth && val > 0 ? 700 : 400,
                        background:
                          !isNetProfit && val === bestMonth && val > 0 ? `${color}0d` : undefined,
                      }}
                    >
                      {val === 0 ? <span className="text-[10px] opacity-30">—</span> : formatCompactNumber(val, lang)}
                    </td>
                  ))}
                  <td
                    className="py-2.5 px-3 text-end font-bold tabular-nums"
                    style={{ color: valColor(total) || metricColor }}
                  >
                    {formatCompactNumber(total, lang)}
                  </td>
                  <td className="py-2.5 px-3 text-end text-[11px] text-noorix-muted tabular-nums">
                    {formatNumber(isNetProfit ? pct : Math.abs(pct), lang)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-noorix-border">
              <td className="py-3 px-3 font-bold text-noorix-text text-[12px]">
                {lang === 'ar' ? 'الإجمالي' : 'Total'}
              </td>
              {grandMonthlyTotals.map((val, mi) => (
                <td key={mi} className="py-3 px-1.5 text-end font-bold tabular-nums" style={{ color: valColor(val) || 'var(--noorix-text)' }}>
                  {val === 0 ? <span className="text-[10px] opacity-30">—</span> : formatCompactNumber(val, lang)}
                </td>
              ))}
              <td className="py-3 px-3 text-end font-bold tabular-nums" style={{ color: valColor(grandTotal) || metricColor }}>
                {formatCompactNumber(grandTotal, lang)}
              </td>
              <td className="py-3 px-3 text-end text-[11px] text-noorix-muted">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
