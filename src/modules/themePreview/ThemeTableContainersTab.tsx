import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  DateField,
  Input,
  MatrixTable,
  ScreenTabs,
  SimpleTable,
  SmartTable,
  SummaryBar,
} from '../../ui';
import { useTranslation } from '../../i18n/useTranslation';
import {
  buildThemePreviewContainerMatrixColumns,
  buildThemePreviewContainerSimpleColumns,
  buildThemePreviewContainerSmartColumns,
  THEME_PREVIEW_CONTAINER_ROWS,
  THEME_PREVIEW_MATRIX_ROWS,
  type ThemePreviewContainerRow,
} from './themePreviewModel';

type SamplePanelProps = {
  id: string;
  titleAr: string;
  titleEn: string;
  hintAr: string;
  hintEn: string;
  children: React.ReactNode;
};

const previewTabs = [
  { id: 'active', label: 'Active' },
  { id: 'archive', label: 'Archive' },
];

function money(value: number) {
  return (
    <span dir="ltr" className="nx-cell-num font-bold">
      {value.toLocaleString('en')} <span className="nx-sar">SR</span>
    </span>
  );
}

function SurfaceNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-noorix-border/80 bg-noorix-bg-muted/45 px-3 py-2 text-[12px] font-medium text-noorix-muted">
      {children}
    </div>
  );
}

function SamplePanel({ id, titleAr, titleEn, hintAr, hintEn, children }: SamplePanelProps) {
  const { lang } = useTranslation();
  const title = lang === 'ar' ? titleAr : titleEn;
  const hint = lang === 'ar' ? hintAr : hintEn;

  return (
    <section className="noorix-surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-noorix-border bg-noorix-bg-muted/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge color="blue" size="sm">{id}</Badge>
            <h3 className="m-0 text-[14px] font-extrabold text-noorix-text">{title}</h3>
          </div>
          <p className="m-0 mt-1 text-[12px] text-noorix-muted">{hint}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EditablePreviewTable({ rows }: { rows: ThemePreviewContainerRow[] }) {
  const columns = useMemo(() => [
    {
      key: 'label',
      label: 'Line',
      minWidth: 180,
      render: (_value: unknown, row: ThemePreviewContainerRow) => (
        <Input value={row.label} size="sm" aria-label={`Line ${row.id}`} readOnly />
      ),
    },
    {
      key: 'date',
      label: 'Date',
      minWidth: 130,
      render: (_value: unknown, row: ThemePreviewContainerRow) => (
        <DateField value={row.date} size="sm" aria-label={`Date ${row.id}`} disabled />
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      numeric: true,
      minWidth: 130,
      render: (_value: unknown, row: ThemePreviewContainerRow) => (
        <Input value={String(row.amount)} size="sm" inputMode="decimal" dir="ltr" aria-label={`Amount ${row.id}`} readOnly />
      ),
    },
    {
      key: 'status',
      label: 'Ready',
      align: 'center' as const,
      minWidth: 100,
      render: (_value: unknown, row: ThemePreviewContainerRow) => (
        <Checkbox checked={row.status !== 'review'} aria-label={`Ready ${row.id}`} readOnly />
      ),
    },
  ], []);

  return (
    <div className="overflow-hidden rounded-xl border border-noorix-border bg-noorix-bg-surface">
      <SimpleTable
        columns={columns}
        data={rows}
        tableMinWidth={760}
        emptyMessage="No rows"
        frameClassName="border-0 shadow-none rounded-none"
      />
    </div>
  );
}

export default function ThemeTableContainersTab() {
  const { lang } = useTranslation();
  const [tab, setTab] = useState('active');
  const smartColumns = useMemo(() => buildThemePreviewContainerSmartColumns(), []);
  const simpleColumns = useMemo(() => buildThemePreviewContainerSimpleColumns(), []);
  const matrixColumns = useMemo(() => buildThemePreviewContainerMatrixColumns(), []);
  const rows = THEME_PREVIEW_CONTAINER_ROWS;
  const isArabic = lang === 'ar';

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-noorix-blue/20 bg-noorix-blue/5 px-4 py-3 text-[13px] text-noorix-text">
        {isArabic
          ? 'مرجع بصري لأنواع حاويات الجداول في النظام. كل العينات هنا بيانات وهمية ولا تنفذ أي عملية حفظ.'
          : 'Visual reference for system table container types. All samples use mock data and perform no writes.'}
      </div>

      <SamplePanel
        id="A"
        titleAr="TableSurface - جدول عرض عادي"
        titleEn="TableSurface - Standard display table"
        hintAr="قوائم الفواتير، الموردين، الأصول، الخزائن، وسجلات العرض المباشر."
        hintEn="Invoices, suppliers, assets, vaults, and plain listing screens."
      >
        <div className="overflow-hidden rounded-xl border border-noorix-border bg-noorix-bg-surface">
          <SmartTable
            columns={smartColumns}
            data={rows}
            total={rows.length}
            page={1}
            pageSize={10}
            title={isArabic ? 'قائمة عرض' : 'Display list'}
            badge={<Badge color="green" size="sm">{rows.length}</Badge>}
            tableMinWidth={920}
            showRowNumbers
            compact
            frameClassName="border-0 shadow-none rounded-none"
            footerRow={[
              { keys: ['id', 'label', 'owner', 'date'], content: isArabic ? 'الإجمالي' : 'Total', className: 'nx-tfoot-label' },
              { keys: ['tax'], content: money(525), className: 'nx-tfoot-num' },
              { keys: ['amount'], content: money(4025), className: 'nx-tfoot-num' },
              { keys: ['status'], content: '' },
            ]}
          />
        </div>
      </SamplePanel>

      <SamplePanel
        id="B"
        titleAr="TabbedTableSurface - جدول داخل تبويب"
        titleEn="TabbedTableSurface - Table inside tabs"
        hintAr="للموردين، HR، الأصول، الطلبات، وأي شاشة فيها تبويبات رئيسية."
        hintEn="For suppliers, HR, assets, orders, and any tabbed section."
      >
        <div className="overflow-hidden rounded-xl border border-noorix-border bg-noorix-bg-surface">
          <div className="border-b border-noorix-border bg-noorix-bg-muted/35 px-3 py-3">
            <ScreenTabs
              items={previewTabs}
              value={tab}
              onChange={setTab}
              variant="segmented"
              segmentedFlat
              contentClassName="p-0"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-noorix-border px-3 py-2.5">
            <div className="min-w-0">
              <strong className="block text-[13px] text-noorix-text">
                {tab === 'active' ? 'Active records' : 'Archive'}
              </strong>
              <span className="text-[12px] text-noorix-muted">
                {isArabic ? 'الشريط والجدول داخل حاوية واحدة فقط' : 'Tabs and table share one surface'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                size="sm"
                placeholder={isArabic ? 'بحث...' : 'Search...'}
                className="w-[180px]"
                readOnly
              />
              <Button size="sm" variant="primary">{isArabic ? 'إجراء' : 'Action'}</Button>
            </div>
          </div>
          <SmartTable
            columns={smartColumns.slice(0, 5)}
            data={tab === 'active' ? rows : rows.slice(0, 1)}
            total={tab === 'active' ? rows.length : 1}
            page={1}
            pageSize={10}
            tableMinWidth={760}
            showRowNumbers
            innerPadding={0}
            showSearchInHeader={false}
            frameClassName="border-0 shadow-none rounded-none"
          />
        </div>
      </SamplePanel>

      <SamplePanel
        id="C"
        titleAr="EditableTableSurface - جدول إدخال وتحرير"
        titleEn="EditableTableSurface - Editable grid"
        hintAr="للمشتريات الجماعية، المصاريف، أو أي صفوف إدخال لا يجب أن تبدو كجدول عرض فقط."
        hintEn="For batch purchases, expenses, and row-entry workflows."
      >
        <EditablePreviewTable rows={rows} />
        <SummaryBar
          className="mt-3"
          items={[
            { key: 'net', label: isArabic ? 'الصافي' : 'Net', value: 3500, tone: 'green', currency: 'SR' },
            { key: 'tax', label: isArabic ? 'الضريبة' : 'Tax', value: 525, tone: 'amber', currency: 'SR' },
            { key: 'total', label: isArabic ? 'الإجمالي' : 'Total', value: 4025, tone: 'blue', currency: 'SR' },
          ]}
        />
      </SamplePanel>

      <SamplePanel
        id="D"
        titleAr="ReportTableSurface - تقرير مالي أو Matrix"
        titleEn="ReportTableSurface - Financial report or matrix"
        hintAr="للتقارير المالية، الربح والخسارة، والتحليلات التي تحتاج أعمدة عريضة أو تثبيت أول عمود."
        hintEn="For financial reports, P&L, and wide analytical matrices."
      >
        <div className="overflow-hidden rounded-xl border border-noorix-border bg-noorix-bg-surface">
          <div className="border-b border-noorix-border bg-gradient-to-l from-noorix-bg-muted/80 to-noorix-bg-surface px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="m-0 text-[15px] font-extrabold text-noorix-text">
                    {isArabic ? 'تقرير أداء مالي' : 'Financial performance report'}
                  </h4>
                  <Badge color="blue" size="sm">{isArabic ? 'شامل الضريبة' : 'VAT inclusive'}</Badge>
                </div>
                <p className="m-0 mt-1 text-[12px] text-noorix-muted">
                  {isArabic ? 'رأس التقرير يوضح الفترة، المصدر، وقاعدة الأرقام قبل الجدول.' : 'Report header states period, source, and number basis before the table.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm">{isArabic ? 'طباعة' : 'Print'}</Button>
                <Button size="sm" variant="primary">PDF</Button>
              </div>
            </div>
          </div>
          <div className="grid gap-3 border-b border-noorix-border p-3 md:grid-cols-3">
            <SurfaceNote>{isArabic ? 'الفترة: Jul 2026' : 'Period: Jul 2026'}</SurfaceNote>
            <SurfaceNote>{isArabic ? 'المصدر: المركز المحاسبي' : 'Source: accounting core'}</SurfaceNote>
            <SurfaceNote>{isArabic ? 'النطاق: كامل الفترة' : 'Scope: full period'}</SurfaceNote>
          </div>
          <SummaryBar
            className="m-3"
            items={[
              { key: 'revenue', label: isArabic ? 'الإيراد' : 'Revenue', value: 26800, tone: 'green', currency: 'SR' },
              { key: 'cost', label: isArabic ? 'التكلفة' : 'Cost', value: 13700, tone: 'amber', currency: 'SR' },
              { key: 'net', label: isArabic ? 'الصافي' : 'Net', value: 13100, tone: 'blue', currency: 'SR' },
            ]}
          />
          <div className="px-3 pb-3">
            <div className="overflow-hidden rounded-lg border border-noorix-border">
            <MatrixTable
              columns={matrixColumns}
              data={THEME_PREVIEW_MATRIX_ROWS}
              tableMinWidth={680}
              stickyHeader
              firstColumnAsHeader
              frameClassName="border-0 shadow-none rounded-none"
              getRowTone={(row) => row.tone}
              getRowAccentColor={(row) => row.tone === 'total' ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-blue)'}
              footer={(
                <tr>
                  <td className="nx-tfoot-label">{isArabic ? 'إجمالي التقرير' : 'Report total'}</td>
                  <td className="nx-tfoot-num">{money(27400)}</td>
                  <td className="nx-tfoot-num">{money(29600)}</td>
                  <td className="nx-tfoot-num">{money(57000)}</td>
                </tr>
              )}
            />
            </div>
          </div>
        </div>
      </SamplePanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <SamplePanel
          id="E"
          titleAr="EmbeddedTableSurface - جدول داخل مودال أو Drawer"
          titleEn="EmbeddedTableSurface - Modal or drawer table"
          hintAr="لملفات المورد، تفاصيل الموظف، تفاصيل الخزنة، والمعاينات الداخلية."
          hintEn="For supplier profiles, employee details, vault details, and previews."
        >
          <div className="overflow-hidden rounded-xl border border-noorix-border bg-noorix-bg-surface">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-noorix-border bg-noorix-bg-muted/35 px-3 py-3">
              <div className="min-w-0">
                <strong className="block text-[13px] text-noorix-text">{isArabic ? 'ملف مختصر' : 'Compact profile'}</strong>
                <span className="text-[12px] text-noorix-muted">
                  {isArabic ? 'داخل مودال/Drawer: أقل ظل، مسافات أضيق، وبدون كرت داخلي زائد.' : 'Inside a modal/drawer: less shadow, tighter spacing, no extra inner card.'}
                </span>
              </div>
              <Button size="sm">{isArabic ? 'إغلاق' : 'Close'}</Button>
            </div>
            <div className="grid gap-2 border-b border-noorix-border p-3 sm:grid-cols-3">
              <SurfaceNote>{isArabic ? 'الحالة: نشط' : 'Status: active'}</SurfaceNote>
              <SurfaceNote>{isArabic ? 'آخر تحديث: 2026-07-08' : 'Updated: 2026-07-08'}</SurfaceNote>
              <SurfaceNote>{isArabic ? 'السجلات: 2' : 'Rows: 2'}</SurfaceNote>
            </div>
            <div className="p-3">
              <div className="overflow-hidden rounded-lg border border-noorix-border">
                <SimpleTable
                  columns={simpleColumns}
                  data={rows.slice(0, 2)}
                  tableMinWidth={620}
                  compact
                  frameClassName="border-0 shadow-none rounded-none"
                />
              </div>
            </div>
          </div>
        </SamplePanel>

        <SamplePanel
          id="F"
          titleAr="FlatListTableSurface - قائمة مسطحة"
          titleEn="FlatListTableSurface - Flat list table"
          hintAr="لحالات HR والجوال عندما لا نريد كرتًا داخل كرت."
          hintEn="For HR and mobile-heavy flows where nested cards should disappear."
        >
          <SmartTable
            columns={smartColumns.slice(0, 4)}
            data={rows}
            total={rows.length}
            page={1}
            pageSize={10}
            showRowNumbers
            tableMinWidth={640}
            frameClassName="noorix-table-frame--mobile-list border-0 shadow-none bg-transparent"
            renderCompactRow={(row) => (
              <div className="flex min-w-0 items-center justify-between gap-3 border-b border-noorix-border px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-noorix-text">{row.label}</div>
                  <div className="text-[12px] text-noorix-muted">{row.date}</div>
                </div>
                {money(row.amount)}
              </div>
            )}
          />
        </SamplePanel>
      </div>
    </div>
  );
}
