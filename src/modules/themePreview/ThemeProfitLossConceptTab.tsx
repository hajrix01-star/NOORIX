import React, { useMemo, useState } from 'react';
import { Badge, Button, FilterToolbar, SimpleTable } from '../../ui';
import type { SimpleTableColumn } from '../../ui';
import { DateFilterBar, useDateFilter } from '../../ui/date';
import { useTranslation } from '../../i18n/useTranslation';
import {
  formatProfitLossMoney,
  formatProfitLossPercent,
  periodFactorFromFilter,
  periodModeFromFilter,
  profitLossLevelOptions,
  profitLossMonthValue,
  profitLossMonths,
  profitLossNumberClass,
  profitLossPercent,
  profitLossPeriodMeta,
  profitLossRowClass,
  profitLossRows,
  profitLossYearTotal,
  scaleProfitLossValue,
  type DetailLevel,
  type PlRow,
} from './themeProfitLossConceptModel';

function ToolbarButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex h-8 items-center justify-center rounded-md border px-3 text-[12px] font-black transition-colors',
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export default function ThemeProfitLossConceptTab() {
  const { lang } = useTranslation();
  const isArabic = lang === 'ar';
  const [level, setLevel] = useState<DetailLevel>(1);
  const dateFilter = useDateFilter();
  const compareFilter = useDateFilter();
  const period = periodModeFromFilter(dateFilter.state.mode, dateFilter.state);
  const selectedPeriod = profitLossPeriodMeta[period];
  const compareFactor = periodFactorFromFilter(compareFilter.state.mode, compareFilter.state);

  const visibleRows = useMemo(
    () => profitLossRows.filter((row) => row.level <= level),
    [level],
  );

  const currentNet = scaleProfitLossValue(65500, selectedPeriod.factor);
  const previousNet = scaleProfitLossValue(55500, selectedPeriod.factor);
  const currentRevenue = scaleProfitLossValue(186000, selectedPeriod.factor);
  const margin = currentRevenue ? (currentNet / currentRevenue) * 100 : 0;

  const labelColumn = useMemo<SimpleTableColumn<PlRow>>(() => ({
    key: 'label',
    label: '',
    minWidth: 380,
    align: 'start',
    headerClassName: 'text-start',
    cellClassName: 'text-start',
    render: (_value, row) => {
      const indent = row.level === 3 ? 'ps-36' : row.level === 2 ? 'ps-20' : 'ps-0';
      const labelClass = row.kind !== 'line'
        ? 'font-black text-slate-900'
        : row.level === 3
          ? 'font-semibold text-slate-500'
          : row.level === 2
            ? 'font-semibold text-slate-700'
            : 'font-semibold text-slate-950';
      return (
        <div className={indent}>
          <div className={`inline-flex items-center ${labelClass}`}>
            {row.level === 2 && row.kind === 'line' ? <span className="me-2 h-1.5 w-1.5 rounded-full bg-slate-300" /> : null}
            {row.level === 3 && row.kind === 'line' ? <span className="me-2 h-px w-5 bg-slate-300" /> : null}
            {isArabic ? row.labelAr : row.labelEn}
          </div>
          {row.noteAr || row.noteEn ? (
            <div className="mt-0.5 text-[11px] font-bold text-slate-500">
              {isArabic ? row.noteAr : row.noteEn}
            </div>
          ) : null}
        </div>
      );
    },
  }), [isArabic]);

  const columns = useMemo<SimpleTableColumn<PlRow>[]>(() => [
    labelColumn,
    {
      key: 'current',
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-slate-900">2026</span>
          <span className="max-w-[130px] truncate text-[11px] font-black text-slate-500">{dateFilter.label}</span>
        </div>
      ),
      numeric: true,
      width: 150,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const current = scaleProfitLossValue(row.current, selectedPeriod.factor);
        return (
          <span className={`inline-block min-w-[112px] text-end font-black ${profitLossNumberClass(current, row.kind)}`} dir="ltr">
            {formatProfitLossMoney(current)}
          </span>
        );
      },
    },
    {
      key: 'previous',
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-slate-900">2025</span>
          <span className="max-w-[130px] truncate text-[11px] font-black text-slate-500">{compareFilter.label}</span>
        </div>
      ),
      numeric: true,
      width: 150,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const previous = scaleProfitLossValue(row.previous, compareFactor);
        return (
          <span className={`inline-block min-w-[112px] text-end font-black ${profitLossNumberClass(previous, row.kind)}`} dir="ltr">
            {formatProfitLossMoney(previous)}
          </span>
        );
      },
    },
    {
      key: 'change',
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-slate-900">%</span>
          <span className="text-[11px] font-black text-slate-500">{isArabic ? 'التغير' : 'Change'}</span>
        </div>
      ),
      numeric: true,
      width: 130,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const current = scaleProfitLossValue(row.current, selectedPeriod.factor);
        const previous = scaleProfitLossValue(row.previous, compareFactor);
        return (
          <span className="inline-block min-w-[78px] text-end font-black text-slate-500" dir="ltr">
            {formatProfitLossPercent(profitLossPercent(current, previous), isArabic)}
          </span>
        );
      },
    },
  ], [compareFactor, compareFilter.label, dateFilter.label, isArabic, labelColumn, selectedPeriod.factor]);

  const yearlyColumns = useMemo<SimpleTableColumn<PlRow>[]>(() => [
    labelColumn,
    ...profitLossMonths.map((month): SimpleTableColumn<PlRow> => ({
      key: month.key,
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-slate-900">{isArabic ? month.labelAr : month.labelEn}</span>
          <span className="text-[11px] font-black text-slate-500">2026</span>
        </div>
      ),
      numeric: true,
      width: 112,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const value = profitLossMonthValue(row, month.factor);
        return (
          <span className={`inline-block min-w-[86px] text-end font-black ${profitLossNumberClass(value, row.kind)}`} dir="ltr">
            {formatProfitLossMoney(value)}
          </span>
        );
      },
    })),
    {
      key: 'total',
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-slate-900">{isArabic ? 'الإجمالي' : 'Total'}</span>
          <span className="text-[11px] font-black text-slate-500">2026</span>
        </div>
      ),
      numeric: true,
      width: 132,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const value = profitLossYearTotal(row);
        return (
          <span className={`inline-block min-w-[104px] text-end font-black ${profitLossNumberClass(value, row.kind)}`} dir="ltr">
            {formatProfitLossMoney(value)}
          </span>
        );
      },
    },
  ], [isArabic, labelColumn]);

  const activeColumns = period === 'year' ? yearlyColumns : columns;
  const tableMinWidth = period === 'year' ? 1860 : 760;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-noorix-border bg-white shadow-sm">
        <FilterToolbar className="border-b border-noorix-border bg-slate-50 px-4 py-3" filtersClassName="justify-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-black text-slate-500">{isArabic ? 'الفترة' : 'Period'}</span>
              <DateFilterBar filter={dateFilter} modes={['month', 'months', 'quarter', 'year']} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-black text-slate-500">{isArabic ? 'المقارنة' : 'Compare with'}</span>
              <DateFilterBar filter={compareFilter} modes={['month', 'months']} />
            </div>
          </div>
        </FilterToolbar>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="blue" size="sm">{isArabic ? 'تصميم مستوحى من Odoo' : 'Odoo-inspired concept'}</Badge>
              <Badge color="amber" size="sm">{isArabic ? 'بيانات تجريبية' : 'Mock data'}</Badge>
            </div>
            <h3 className="m-0 mt-3 text-[22px] font-black text-noorix-text">
              {isArabic ? 'تقرير الربح والخسارة' : 'Profit and loss report'}
            </h3>
            <p className="m-0 mt-2 max-w-[740px] text-[13px] leading-6 text-noorix-muted">
              {isArabic
                ? 'نسخة مالية هادئة: جدول مباشر، مقارنة سنة بسنة، وثلاثة مستويات تفصيل بدون اعتماد على التقرير الحالي.'
                : 'A calm financial view: direct table, year comparison, and three detail levels without depending on the current report.'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="block text-[12px] font-black text-slate-500">{isArabic ? 'ملخص التقرير' : 'Report summary'}</span>
                <span className="mt-1 block text-[13px] font-bold text-slate-500">
                  {period === 'year' ? (isArabic ? 'سنة كاملة' : 'Full year') : dateFilter.label}
                </span>
              </div>
              <Badge color={currentNet >= previousNet ? 'green' : 'red'} size="sm">
                {formatProfitLossPercent(profitLossPercent(currentNet, previousNet), isArabic)}
              </Badge>
            </div>

            <div className="py-4">
              <span className="block text-[12px] font-black text-slate-500">{isArabic ? 'صافي الربح' : 'Net profit'}</span>
              <span className="mt-1 block text-[28px] font-black leading-none text-slate-950" dir="ltr">
                {formatProfitLossMoney(currentNet)}
              </span>
              <span className="mt-1 block text-[12px] font-black text-slate-500">SR</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-slate-50 p-3">
                <span className="block text-[11px] font-black text-slate-500">{isArabic ? 'هامش الربح' : 'Profit margin'}</span>
                <span className="mt-1 block text-[15px] font-black text-slate-900" dir="ltr">
                  {formatProfitLossPercent(margin, isArabic)}
                </span>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <span className="block text-[11px] font-black text-slate-500">{isArabic ? 'الإيرادات' : 'Revenue'}</span>
                <span className="mt-1 block text-[15px] font-black text-slate-900" dir="ltr">
                  {formatProfitLossMoney(currentRevenue)}
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-600">
              {isArabic ? 'المقارنة مع' : 'Compared with'} {compareFilter.label}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-noorix-border px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {profitLossLevelOptions.map((item) => (
              <ToolbarButton key={item.id} active={level === item.id} onClick={() => setLevel(item.id)}>
                {isArabic ? item.labelAr : item.labelEn}
              </ToolbarButton>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-bold text-noorix-muted">
              {period === 'year'
                ? (isArabic ? 'السنة تعرض الأشهر كأعمدة للمقارنة بين شهرين أو أكثر' : 'Year view shows months as columns for multi-month comparison')
                : `${dateFilter.label} ${isArabic ? 'مقارنة بـ' : 'vs'} ${compareFilter.label}`}
            </span>
            <Button size="sm">PDF</Button>
            <Button size="sm">XLSX</Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <SimpleTable
          columns={activeColumns}
          data={visibleRows}
          tableMinWidth={tableMinWidth}
          compact
          cellPadding="8px 14px"
          frameClassName="border-0 shadow-none rounded-none"
          tableClassName="[&_th:not(:first-child)]:border [&_th:not(:first-child)]:border-slate-300 [&_th:not(:first-child)]:bg-white [&_td:not(:first-child)]:bg-slate-50/70"
          getRowClassName={(row) => profitLossRowClass(row.kind)}
        />
      </section>
    </div>
  );
}
