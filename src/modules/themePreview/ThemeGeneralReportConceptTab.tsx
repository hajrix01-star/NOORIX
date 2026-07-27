import React, { useMemo, useState } from 'react';
import { Badge, Button, FilterToolbar, SimpleTable } from '../../ui';
import type { SimpleTableColumn } from '../../ui';
import { DateFilterBar, useDateFilter } from '../../ui/date';
import { useTranslation } from '../../i18n/useTranslation';

type DetailLevel = 1 | 2 | 3;
type RowKind = 'line' | 'subtotal' | 'result';
type PeriodMode = 'month' | 'quarter' | 'half' | 'year';

type GeneralRow = {
  id: string;
  labelAr: string;
  labelEn: string;
  level: DetailLevel;
  kind: RowKind;
  current: number;
  previous: number;
};

const periodMeta: Record<PeriodMode, { factor: number }> = {
  month: { factor: 1 },
  quarter: { factor: 3.05 },
  half: { factor: 6.1 },
  year: { factor: 12.2 },
};

const levelOptions: { id: DetailLevel; labelAr: string; labelEn: string }[] = [
  { id: 1, labelAr: 'المستوى 1', labelEn: 'Level 1' },
  { id: 2, labelAr: 'المستوى 2', labelEn: 'Level 2' },
  { id: 3, labelAr: 'المستوى 3', labelEn: 'Level 3' },
];

const rows: GeneralRow[] = [
  { id: 'cash', labelAr: 'النقد وما في حكمه', labelEn: 'Cash and equivalents', level: 1, kind: 'line', current: 184600, previous: 162400 },
  { id: 'bank', labelAr: 'أرصدة البنوك', labelEn: 'Bank balances', level: 2, kind: 'line', current: 137800, previous: 121600 },
  { id: 'petty-cash', labelAr: 'العهد والصناديق', labelEn: 'Petty cash and vaults', level: 2, kind: 'line', current: 46800, previous: 40800 },
  { id: 'main-branch-vault', labelAr: 'صندوق الفرع الرئيسي', labelEn: 'Main branch vault', level: 3, kind: 'line', current: 19600, previous: 17800 },
  { id: 'sales-vault', labelAr: 'عهد نقاط البيع', labelEn: 'POS cash custody', level: 3, kind: 'line', current: 27200, previous: 23000 },

  { id: 'receivables', labelAr: 'الذمم المدينة والتحصيل', labelEn: 'Receivables and collection', level: 1, kind: 'line', current: 72900, previous: 68400 },
  { id: 'customers', labelAr: 'عملاء تجاريون', labelEn: 'Trade customers', level: 2, kind: 'line', current: 48200, previous: 45900 },
  { id: 'cards', labelAr: 'تسويات البطاقات', labelEn: 'Card settlements', level: 2, kind: 'line', current: 24700, previous: 22500 },
  { id: 'due-week', labelAr: 'مستحق خلال 7 أيام', labelEn: 'Due within 7 days', level: 3, kind: 'line', current: 33100, previous: 30600 },

  { id: 'inventory', labelAr: 'المخزون', labelEn: 'Inventory', level: 1, kind: 'line', current: 93600, previous: 88400 },
  { id: 'food-stock', labelAr: 'مواد غذائية', labelEn: 'Food stock', level: 2, kind: 'line', current: 55800, previous: 53400 },
  { id: 'packing-stock', labelAr: 'مواد تغليف', labelEn: 'Packaging stock', level: 2, kind: 'line', current: 21600, previous: 19700 },
  { id: 'slow-stock', labelAr: 'مخزون بطيء الحركة', labelEn: 'Slow-moving stock', level: 3, kind: 'line', current: 16200, previous: 15300 },

  { id: 'assets-total', labelAr: 'إجمالي الأصول التشغيلية', labelEn: 'Total operating assets', level: 1, kind: 'subtotal', current: 351100, previous: 319200 },

  { id: 'payables', labelAr: 'الالتزامات قصيرة الأجل', labelEn: 'Short-term obligations', level: 1, kind: 'line', current: -126700, previous: -119500 },
  { id: 'suppliers', labelAr: 'موردون', labelEn: 'Suppliers', level: 2, kind: 'line', current: -74400, previous: -69200 },
  { id: 'tax', labelAr: 'ضرائب ورسوم مستحقة', labelEn: 'Taxes and fees payable', level: 2, kind: 'line', current: -23100, previous: -21800 },
  { id: 'payroll-due', labelAr: 'مستحقات موظفين', labelEn: 'Employee accruals', level: 2, kind: 'line', current: -29200, previous: -28500 },
  { id: 'critical-suppliers', labelAr: 'موردون يحتاجون جدولة', labelEn: 'Suppliers needing scheduling', level: 3, kind: 'line', current: -31800, previous: -29400 },

  { id: 'working-capital', labelAr: 'صافي رأس المال العامل', labelEn: 'Net working capital', level: 1, kind: 'subtotal', current: 224400, previous: 199700 },
  { id: 'period-result', labelAr: 'نتيجة الفترة التجريبية', labelEn: 'Mock period result', level: 1, kind: 'result', current: 97800, previous: 84200 },
];

function monthSpanCount(startYear: number, startMonth: number, endYear: number, endMonth: number) {
  const start = startYear * 12 + startMonth;
  const end = endYear * 12 + endMonth;
  return Math.abs(end - start) + 1;
}

function periodModeFromFilter(mode: string, state: ReturnType<typeof useDateFilter>['state']): PeriodMode {
  if (mode === 'year') return 'year';
  if (mode === 'quarter') return 'quarter';
  if (mode === 'months') {
    const count = monthSpanCount(
      state.monthRangeStartYear,
      state.monthRangeStartMonth,
      state.monthRangeEndYear,
      state.monthRangeEndMonth,
    );
    if (count >= 10) return 'year';
    if (count >= 5) return 'half';
    if (count >= 2) return 'quarter';
  }
  return 'month';
}

function factorFromFilter(mode: string, state: ReturnType<typeof useDateFilter>['state']) {
  return periodMeta[periodModeFromFilter(mode, state)].factor;
}

function scale(value: number, factor: number) {
  return Math.round(value * factor);
}

function formatMoney(value: number) {
  const sign = value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function percent(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatPercent(value: number | null, isArabic: boolean) {
  if (value == null || !Number.isFinite(value)) return isArabic ? 'غير منطقي' : 'N/A';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function rowClass(kind: RowKind) {
  if (kind === 'result') return 'bg-slate-300/80 font-black';
  if (kind === 'subtotal') return 'bg-slate-200/90 font-black';
  return 'bg-white';
}

function numberClass(value: number, kind: RowKind) {
  if (kind !== 'line') return 'text-slate-700';
  if (value < 0) return 'text-slate-500';
  return 'text-slate-700';
}

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

export default function ThemeGeneralReportConceptTab() {
  const { lang } = useTranslation();
  const isArabic = lang === 'ar';
  const [level, setLevel] = useState<DetailLevel>(1);
  const dateFilter = useDateFilter();
  const compareFilter = useDateFilter();
  const currentFactor = factorFromFilter(dateFilter.state.mode, dateFilter.state);
  const compareFactor = factorFromFilter(compareFilter.state.mode, compareFilter.state);

  const visibleRows = useMemo(
    () => rows.filter((row) => row.level <= level),
    [level],
  );

  const currentAssets = scale(351100, currentFactor);
  const currentObligations = scale(-126700, currentFactor);
  const currentResult = scale(97800, currentFactor);
  const previousResult = scale(84200, compareFactor);

  const labelColumn = useMemo<SimpleTableColumn<GeneralRow>>(() => ({
    key: 'label',
    label: '',
    minWidth: 400,
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
        </div>
      );
    },
  }), [isArabic]);

  const columns = useMemo<SimpleTableColumn<GeneralRow>[]>(() => [
    labelColumn,
    {
      key: 'current',
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-slate-900">2026</span>
          <span className="max-w-[140px] truncate text-[11px] font-black text-slate-500">{dateFilter.label}</span>
        </div>
      ),
      numeric: true,
      width: 160,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const current = scale(row.current, currentFactor);
        return (
          <span className={`inline-block min-w-[116px] text-end font-black ${numberClass(current, row.kind)}`} dir="ltr">
            {formatMoney(current)}
          </span>
        );
      },
    },
    {
      key: 'compare',
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-slate-900">2025</span>
          <span className="max-w-[140px] truncate text-[11px] font-black text-slate-500">{compareFilter.label}</span>
        </div>
      ),
      numeric: true,
      width: 160,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const previous = scale(row.previous, compareFactor);
        return (
          <span className={`inline-block min-w-[116px] text-end font-black ${numberClass(previous, row.kind)}`} dir="ltr">
            {formatMoney(previous)}
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
        const current = scale(row.current, currentFactor);
        const previous = scale(row.previous, compareFactor);
        return (
          <span className="inline-block min-w-[78px] text-end font-black text-slate-500" dir="ltr">
            {formatPercent(percent(current, previous), isArabic)}
          </span>
        );
      },
    },
  ], [compareFactor, compareFilter.label, currentFactor, dateFilter.label, isArabic, labelColumn]);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-noorix-border bg-white shadow-sm">
        <FilterToolbar
          className="border-b border-noorix-border bg-slate-50 px-4 py-3"
          filtersClassName="justify-center"
        >
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

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="blue" size="sm">{isArabic ? 'تصميم جدولي جديد' : 'New table concept'}</Badge>
              <Badge color="amber" size="sm">{isArabic ? 'بيانات تجريبية' : 'Mock data'}</Badge>
            </div>
            <h3 className="m-0 mt-3 text-[22px] font-black text-noorix-text">
              {isArabic ? 'تقرير عام تجريبي' : 'General report concept'}
            </h3>
            <p className="m-0 mt-2 max-w-[760px] text-[13px] leading-6 text-noorix-muted">
              {isArabic
                ? 'نسخة معاينة تعتمد جدولًا ماليًا مباشرًا بنفس روح تقرير الربح والخسارة، مع مستويات تفصيل واضحة وفلاتر مقارنة بين شهر أو أكثر.'
                : 'A preview-only financial table in the same spirit as the profit and loss report, with clear detail levels and month or multi-month comparison filters.'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="block text-[12px] font-black text-slate-500">{isArabic ? 'ملخص التقرير العام' : 'General summary'}</span>
                <span className="mt-1 block text-[13px] font-bold text-slate-500">{dateFilter.label}</span>
              </div>
              <Badge color={currentResult >= previousResult ? 'green' : 'red'} size="sm">
                {formatPercent(percent(currentResult, previousResult), isArabic)}
              </Badge>
            </div>

            <div className="py-4">
              <span className="block text-[12px] font-black text-slate-500">{isArabic ? 'نتيجة الفترة' : 'Period result'}</span>
              <span className="mt-1 block text-[28px] font-black leading-none text-slate-950" dir="ltr">
                {formatMoney(currentResult)}
              </span>
              <span className="mt-1 block text-[12px] font-black text-slate-500">SR</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-slate-50 p-3">
                <span className="block text-[11px] font-black text-slate-500">{isArabic ? 'الأصول' : 'Assets'}</span>
                <span className="mt-1 block text-[15px] font-black text-slate-900" dir="ltr">
                  {formatMoney(currentAssets)}
                </span>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <span className="block text-[11px] font-black text-slate-500">{isArabic ? 'الالتزامات' : 'Obligations'}</span>
                <span className="mt-1 block text-[15px] font-black text-slate-900" dir="ltr">
                  {formatMoney(currentObligations)}
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
            {levelOptions.map((item) => (
              <ToolbarButton key={item.id} active={level === item.id} onClick={() => setLevel(item.id)}>
                {isArabic ? item.labelAr : item.labelEn}
              </ToolbarButton>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-bold text-noorix-muted">
              {dateFilter.label} {isArabic ? 'مقارنة بـ' : 'vs'} {compareFilter.label}
            </span>
            <Button size="sm">PDF</Button>
            <Button size="sm">XLSX</Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <SimpleTable
          columns={columns}
          data={visibleRows}
          tableMinWidth={850}
          compact
          cellPadding="8px 14px"
          frameClassName="border-0 shadow-none rounded-none"
          tableClassName="[&_th:not(:first-child)]:border [&_th:not(:first-child)]:border-slate-300 [&_th:not(:first-child)]:bg-white [&_td:not(:first-child)]:bg-slate-50/70"
          getRowClassName={(row) => rowClass(row.kind)}
          emptyMessage={isArabic ? 'لا توجد بيانات تجريبية' : 'No mock data'}
        />
      </section>
    </div>
  );
}
