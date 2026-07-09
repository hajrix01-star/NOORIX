import React, { useMemo, useState } from 'react';
import { Badge, Button, SimpleTable } from '../../ui';
import type { SimpleTableColumn } from '../../ui';
import { useTranslation } from '../../i18n/useTranslation';

type PeriodMode = 'month' | 'quarter' | 'half' | 'year';
type DetailLevel = 1 | 2 | 3;
type RowKind = 'line' | 'subtotal' | 'result';

type PlRow = {
  id: string;
  labelAr: string;
  labelEn: string;
  level: DetailLevel;
  kind: RowKind;
  current: number;
  previous: number;
  noteAr?: string;
  noteEn?: string;
};

const periodOptions: { id: PeriodMode; labelAr: string; labelEn: string; subAr: string; subEn: string; factor: number }[] = [
  { id: 'month', labelAr: '2026 - يوليو', labelEn: '2026 - Jul', subAr: 'شهر واحد', subEn: 'One month', factor: 1 },
  { id: 'quarter', labelAr: '2026 - 3 أشهر', labelEn: '2026 - 3 months', subAr: 'مايو - يوليو', subEn: 'May - Jul', factor: 3.05 },
  { id: 'half', labelAr: '2026 - 6 أشهر', labelEn: '2026 - 6 months', subAr: 'فبراير - يوليو', subEn: 'Feb - Jul', factor: 6.1 },
  { id: 'year', labelAr: '2026', labelEn: '2026', subAr: 'سنة كاملة', subEn: 'Full year', factor: 12.2 },
];

const levelOptions: { id: DetailLevel; labelAr: string; labelEn: string }[] = [
  { id: 1, labelAr: 'المستوى 1', labelEn: 'Level 1' },
  { id: 2, labelAr: 'المستوى 2', labelEn: 'Level 2' },
  { id: 3, labelAr: 'المستوى 3', labelEn: 'Level 3' },
];

const rows: PlRow[] = [
  { id: 'revenue', labelAr: 'الإيرادات', labelEn: 'Revenue', level: 1, kind: 'line', current: 186000, previous: 171000 },
  { id: 'store-sales', labelAr: 'مبيعات الفروع', labelEn: 'Store sales', level: 2, kind: 'line', current: 128500, previous: 119200 },
  { id: 'delivery-sales', labelAr: 'مبيعات التوصيل', labelEn: 'Delivery sales', level: 2, kind: 'line', current: 42100, previous: 37200 },
  { id: 'other-revenue', labelAr: 'دخل تشغيلي آخر', labelEn: 'Other operating income', level: 2, kind: 'line', current: 15400, previous: 14600 },
  { id: 'olaya', labelAr: 'فرع العليا', labelEn: 'Olaya branch', level: 3, kind: 'line', current: 52300, previous: 48900 },
  { id: 'rawdah', labelAr: 'فرع الروضة', labelEn: 'Rawdah branch', level: 3, kind: 'line', current: 40700, previous: 38100 },
  { id: 'apps', labelAr: 'تطبيقات التوصيل', labelEn: 'Delivery apps', level: 3, kind: 'line', current: 32500, previous: 28400 },

  { id: 'cost', labelAr: 'تكاليف الإيرادات', labelEn: 'Cost of revenue', level: 1, kind: 'line', current: -74400, previous: -70300 },
  { id: 'food', labelAr: 'مواد غذائية', labelEn: 'Food materials', level: 2, kind: 'line', current: -51200, previous: -48600 },
  { id: 'packaging', labelAr: 'تغليف وتشغيل', labelEn: 'Packaging and operations', level: 2, kind: 'line', current: -14300, previous: -13200 },
  { id: 'waste', labelAr: 'هدر وتسويات تكلفة', labelEn: 'Waste and cost adjustments', level: 2, kind: 'line', current: -8900, previous: -8500 },
  { id: 'protein', labelAr: 'لحوم وبروتين', labelEn: 'Meat and protein', level: 3, kind: 'line', current: -21600, previous: -20400 },
  { id: 'produce', labelAr: 'خضار ومكونات', labelEn: 'Produce and ingredients', level: 3, kind: 'line', current: -17800, previous: -16900 },
  { id: 'boxes', labelAr: 'علب وأكياس', labelEn: 'Boxes and bags', level: 3, kind: 'line', current: -9100, previous: -8400 },

  { id: 'gross', labelAr: 'إجمالي الربح', labelEn: 'Gross profit', level: 1, kind: 'subtotal', current: 111600, previous: 100700 },

  { id: 'operating-expenses', labelAr: 'نفقات التشغيل', labelEn: 'Operating expenses', level: 1, kind: 'line', current: -49200, previous: -46800 },
  { id: 'payroll', labelAr: 'رواتب ومزايا', labelEn: 'Payroll and benefits', level: 2, kind: 'line', current: -25800, previous: -25100 },
  { id: 'rent', labelAr: 'إيجارات وخدمات', labelEn: 'Rent and utilities', level: 2, kind: 'line', current: -13600, previous: -13200 },
  { id: 'marketing', labelAr: 'تسويق وعمولات', labelEn: 'Marketing and commissions', level: 2, kind: 'line', current: -9800, previous: -8500 },
  { id: 'base-salaries', labelAr: 'رواتب أساسية', labelEn: 'Base salaries', level: 3, kind: 'line', current: -19300, previous: -18800 },
  { id: 'utilities', labelAr: 'كهرباء ومياه', labelEn: 'Electricity and water', level: 3, kind: 'line', current: -6100, previous: -5700 },
  { id: 'campaigns', labelAr: 'حملات محلية', labelEn: 'Local campaigns', level: 3, kind: 'line', current: -5600, previous: -4600 },

  { id: 'operating-income', labelAr: 'الدخل التشغيلي (أو الخسائر التشغيلية)', labelEn: 'Operating income (loss)', level: 1, kind: 'subtotal', current: 62400, previous: 53900 },
  { id: 'other-income', labelAr: 'دخل آخر', labelEn: 'Other income', level: 1, kind: 'line', current: 8200, previous: 6400 },
  { id: 'other-expense', labelAr: 'النفقات الأخرى', labelEn: 'Other expenses', level: 1, kind: 'line', current: -5100, previous: -4800 },
  { id: 'finance-income', labelAr: 'عوائد بنكية', labelEn: 'Bank returns', level: 3, kind: 'line', current: 2200, previous: 1800 },
  { id: 'finance-fees', labelAr: 'رسوم تمويلية', labelEn: 'Finance fees', level: 3, kind: 'line', current: -1700, previous: -1600 },

  { id: 'net', labelAr: 'صافي الربح', labelEn: 'Net profit', level: 1, kind: 'subtotal', current: 65500, previous: 55500 },
  { id: 'provisions', labelAr: 'التخصيصات والمسحوبات', labelEn: 'Provisions and withdrawals', level: 1, kind: 'line', current: -9500, previous: -8200 },
  { id: 'owner-withdrawals', labelAr: 'مسحوبات المالك', labelEn: 'Owner withdrawals', level: 3, kind: 'line', current: -6200, previous: -5600 },
  { id: 'reserve', labelAr: 'احتياطي تشغيلي', labelEn: 'Operating reserve', level: 3, kind: 'line', current: -3300, previous: -2600 },
  { id: 'retained', labelAr: 'صافي الربح المتبقي بعد المخصصات والمسحوبات', labelEn: 'Retained profit after provisions and withdrawals', level: 1, kind: 'result', current: 56000, previous: 47300 },
];

function scale(value: number, factor: number) {
  return Math.round(value * factor);
}

function formatMoney(value: number) {
  const sign = value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export default function ThemeProfitLossConceptTab() {
  const { lang } = useTranslation();
  const isArabic = lang === 'ar';
  const [period, setPeriod] = useState<PeriodMode>('year');
  const [level, setLevel] = useState<DetailLevel>(1);
  const selectedPeriod = periodOptions.find((item) => item.id === period) ?? periodOptions[0];

  const visibleRows = useMemo(
    () => rows.filter((row) => row.level <= level),
    [level],
  );

  const currentNet = scale(65500, selectedPeriod.factor);
  const previousNet = scale(55500, selectedPeriod.factor);
  const currentRevenue = scale(186000, selectedPeriod.factor);
  const margin = currentRevenue ? (currentNet / currentRevenue) * 100 : 0;

  const columns = useMemo<SimpleTableColumn<PlRow>[]>(() => [
    {
      key: 'label',
      label: '',
      minWidth: 330,
      align: 'start',
      headerClassName: 'text-start',
      cellClassName: 'text-start',
      render: (_value, row) => {
        const indent = row.level === 3 ? 'ps-10' : row.level === 2 ? 'ps-6' : 'ps-4';
        return (
          <div className={indent}>
            <div className={row.kind === 'line' ? 'font-semibold text-slate-900' : 'font-black text-slate-900'}>
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
    },
    {
      key: 'current',
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-slate-900">2026</span>
          <span className="text-[11px] font-black text-slate-500">{isArabic ? 'الرصيد' : 'Balance'}</span>
        </div>
      ),
      numeric: true,
      width: 150,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const current = scale(row.current, selectedPeriod.factor);
        return (
          <span className={`inline-block min-w-[112px] text-end font-black ${numberClass(current, row.kind)}`} dir="ltr">
            {formatMoney(current)}
          </span>
        );
      },
    },
    {
      key: 'previous',
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-slate-900">2025</span>
          <span className="text-[11px] font-black text-slate-500">{isArabic ? 'الرصيد' : 'Balance'}</span>
        </div>
      ),
      numeric: true,
      width: 150,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const previous = scale(row.previous, selectedPeriod.factor);
        return (
          <span className={`inline-block min-w-[112px] text-end font-black ${numberClass(previous, row.kind)}`} dir="ltr">
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
        const current = scale(row.current, selectedPeriod.factor);
        const previous = scale(row.previous, selectedPeriod.factor);
        return (
          <span className="inline-block min-w-[78px] text-end font-black text-slate-500" dir="ltr">
            {formatPercent(percent(current, previous), isArabic)}
          </span>
        );
      },
    },
  ], [isArabic, selectedPeriod.factor]);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-noorix-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-noorix-border bg-slate-50 px-4 py-3">
          {periodOptions.map((item) => (
            <ToolbarButton key={item.id} active={period === item.id} onClick={() => setPeriod(item.id)}>
              {isArabic ? item.labelAr : item.labelEn}
            </ToolbarButton>
          ))}
          <ToolbarButton active>{isArabic ? 'مقارنة %' : 'Compare %'}</ToolbarButton>
          <ToolbarButton>{isArabic ? 'القيود المرحلة' : 'Posted entries'}</ToolbarButton>
          <ToolbarButton>{isArabic ? 'الموازنة' : 'Budget'}</ToolbarButton>
          <ToolbarButton>{isArabic ? 'SR' : 'SR'}</ToolbarButton>
        </div>

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
                ? 'نسخة مالية هادئة شبيهة بروح Odoo: جدول مباشر، مقارنة سنة بسنة، وثلاثة مستويات تفصيل بدون تعقيد أو اعتماد على التقرير الحالي.'
                : 'A calm Odoo-style financial view: direct table, year comparison, and three detail levels without depending on the current report.'}
            </p>
          </div>

          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-black text-slate-500">{isArabic ? 'صافي الربح' : 'Net profit'}</span>
              <span className="text-[13px] font-black text-slate-900" dir="ltr">{formatMoney(currentNet)} SR</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-black text-slate-500">{isArabic ? 'هامش الربح' : 'Profit margin'}</span>
              <span className="text-[13px] font-black text-slate-900" dir="ltr">{formatPercent(margin, isArabic)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-black text-slate-500">{isArabic ? 'مقارنة 2025' : 'Vs 2025'}</span>
              <Badge color={currentNet >= previousNet ? 'green' : 'red'} size="sm">
                {formatPercent(percent(currentNet, previousNet), isArabic)}
              </Badge>
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
              {isArabic ? selectedPeriod.subAr : selectedPeriod.subEn}
            </span>
            <Button size="sm">{isArabic ? 'PDF' : 'PDF'}</Button>
            <Button size="sm">{isArabic ? 'XLSX' : 'XLSX'}</Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <SimpleTable
          columns={columns}
          data={visibleRows}
          tableMinWidth={760}
          compact
          cellPadding="8px 14px"
          frameClassName="border-0 shadow-none rounded-none"
          tableClassName="[&_th:not(:first-child)]:border [&_th:not(:first-child)]:border-slate-300 [&_th:not(:first-child)]:bg-white [&_td:not(:first-child)]:bg-slate-50/70"
          getRowClassName={(row) => rowClass(row.kind)}
        />
      </section>
    </div>
  );
}
