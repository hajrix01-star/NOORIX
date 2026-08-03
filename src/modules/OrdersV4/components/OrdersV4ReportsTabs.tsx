import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  OrdersV4CancellationReason,
  OrdersV4Document,
  OrdersV4ItemsReportRow,
} from '../../../types/api';
import { Button, DataBar, Input, SearchableOptionsPicker, SmartTable, usePrintPreview, type SimpleTableColumn } from '../../../ui';
import { exportToExcel } from '../../../utils/exportUtils';
import { buildPrintTableHtml } from '../../../utils/printTableHtml';
import {
  OrdersV4Field,
  OrdersV4Kpi,
  OrdersV4Panel,
  OrdersV4QueryState,
  OrdersV4Select,
  OrdersV4Table as SimpleTable,
  v4Date,
  v4ReportNumber,
  v4UserLabel,
} from '../OrdersV4Shared';
import { useOrdersV4ActivityReport, useOrdersV4SalesReport } from '../useOrdersV4';
import { ORDERS_V4_CANCELLATION_REASON_OPTIONS, ordersV4CancellationReasonLabel } from './ordersV4CancellationReasons';
import { useTranslation } from '../../../i18n/useTranslation';
import { useTabSearchParam } from '../../../hooks/useTabSearchParam';
import {
  aggregateDocumentsByDay,
  aggregateDocumentsByEmployee,
  aggregateDocumentsBySection,
  aggregateItems,
  metricValue,
  topItemsBySection,
  type OrdersV4ReportGroup,
  type OrdersV4ReportMetric,
} from './ordersV4ReportAnalytics';
import { OrdersV4PurchaseHistorySheet } from './OrdersV4PurchaseHistorySheet';
import { ordersV4ReportFacetOptions } from './ordersV4ReportFilters';

const CHART_COLORS = ['#15803d', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#db2777'];

function ReportsFilterBar({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 rounded-xl border border-noorix-border bg-noorix-bg-muted/35 p-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

function ReportActions({ rows, filename, title }: { rows: Record<string, unknown>[]; filename: string; title: string }) {
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({ title, closeLabel: 'إغلاق', printLabel: 'طباعة / PDF' });
  const print = () => {
    const labels = rows.length ? Object.keys(rows[0]) : [];
    openPrintDocumentPreview({
      title,
      landscape: true,
      body: buildPrintTableHtml({
        columns: labels.map((label, index) => ({ key: String(index), header: label })),
        rows: rows.map((row) => labels.reduce<Record<string, unknown>>((result, label, index) => {
          result[String(index)] = row[label] ?? '';
          return result;
        }, {})),
      }),
    });
  };
  return <><div className="flex flex-wrap gap-2 print:hidden">
    <Button size="sm" variant="ghost" disabled={!rows.length} onClick={() => exportToExcel(rows, filename, { title })}>تصدير Excel</Button>
    <Button size="sm" variant="ghost" disabled={!rows.length} onClick={print}>طباعة / PDF</Button>
  </div>{printPreviewModal}</>;
}

function metricLabel(metric: OrdersV4ReportMetric): string {
  return metric === 'amount' ? 'المبلغ' : metric === 'quantity' ? 'الكمية المعيارية' : 'عدد العمليات';
}

function HorizontalBars({ rows, metric, color = '#15803d', limit }: { rows: OrdersV4ReportGroup[]; metric: OrdersV4ReportMetric; color?: string; limit?: number }) {
  const visible = typeof limit === 'number' ? rows.slice(0, limit) : rows;
  const max = Math.max(...visible.map((row) => metricValue(row, metric)), 1);
  if (!visible.length) return <div className="py-8 text-center text-[13px] text-noorix-muted">لا توجد بيانات ضمن الفلاتر الحالية</div>;
  return <div className="flex flex-col gap-3">
    {visible.map((row) => {
      const value = metricValue(row, metric);
      return <div key={row.id} className="grid grid-cols-[minmax(80px,1fr)_minmax(100px,2fr)_auto] items-center gap-2">
        <span className="truncate text-[12px] font-bold" title={row.label}>{row.label}</span>
        <div className="h-6 overflow-hidden rounded-md bg-noorix-bg-muted"><DataBar className="h-full rounded-md" widthPercent={(value / max) * 100} color={color} /></div>
        <span className="min-w-[70px] text-left text-[12px] font-bold tabular-nums">{v4ReportNumber(value)}{metric === 'amount' ? ' ر.س' : ''}</span>
      </div>;
    })}
  </div>;
}

function TrendChart({ documents, metric }: { documents: OrdersV4Document[]; metric: OrdersV4ReportMetric }) {
  const data = useMemo(() => aggregateDocumentsByDay(documents, metric), [documents, metric]);
  const sections = useMemo(() => [...new Set(documents.map((row) => row.section?.nameAr || 'غير محدد'))], [documents]);
  if (!data.length) return <div className="flex h-56 items-center justify-center text-[13px] text-noorix-muted">لا توجد حركة لعرضها</div>;
  return <div className="h-[280px] w-full" dir="ltr">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
        <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={55} />
        <Tooltip
          formatter={(value) => [v4ReportNumber(value), metricLabel(metric)]}
          labelFormatter={(value) => `\u200E${String(value).slice(0, 10)}\u200E`}
          contentStyle={{ direction: 'rtl', textAlign: 'right' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, direction: 'rtl' }} />
        {sections.map((section, index) => <Line key={section} type="monotone" dataKey={section} name={section} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2.5} dot={{ r: 2 }} connectNulls />)}
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

function ReportViewTabs<T extends string>({ value, items, onChange }: { value: T; items: Array<{ id: T; label: string }>; onChange: (value: T) => void }) {
  return <div className="flex w-full gap-2 overflow-x-auto rounded-xl border border-noorix-border bg-noorix-bg-muted p-2 [scrollbar-width:thin] print:hidden">
    {items.map((item) => <Button key={item.id} type="button" size="sm" variant={value === item.id ? 'primary' : 'ghost'} className="shrink-0 whitespace-nowrap" onClick={() => onChange(item.id)}>{item.label}</Button>)}
  </div>;
}

type DetailedItemRow = OrdersV4ItemsReportRow & { sections: string; inputUnits: string; recordedQuantities: string; paymentMethods: string; lastDate: string };

function detailedItems(documents: OrdersV4Document[]): DetailedItemRow[] {
  const basic = aggregateItems(documents);
  return basic.map((row) => {
    const matching = documents.flatMap((document) => document.lines.filter((line) => line.itemId === row.itemId).map((line) => ({ document, line })));
    const values = (getter: (entry: (typeof matching)[number]) => string) => [...new Set(matching.map(getter).filter(Boolean))].join('، ');
    const recorded = new Map<string, number>();
    matching.forEach(({ line }) => recorded.set(line.inputUnit.nameAr, (recorded.get(line.inputUnit.nameAr) ?? 0) + Number(line.inputQuantity || 0)));
    return {
      ...row,
      sections: values(({ document }) => document.section?.nameAr || 'غير محدد'),
      inputUnits: values(({ line }) => line.inputUnit.nameAr),
      recordedQuantities: [...recorded.entries()].map(([unitName, quantity]) => `${v4ReportNumber(quantity)} ${unitName}`).join('، '),
      paymentMethods: values(({ document }) => document.paymentMethod === 'custody' ? 'عهدة' : document.paymentMethod === 'cash' ? 'نقد' : document.paymentMethod === 'transfer' ? 'تحويل' : ''),
      lastDate: matching.map(({ document }) => document.documentDate).sort().at(-1) || '',
    };
  });
}

export function OrdersV4ItemsReportTab({ companyId, startDate, endDate }: { companyId: string; startDate: string; endDate: string }) {
  const [documentType, setDocumentType] = useState<'purchase' | 'registration' | ''>('purchase');
  const [search, setSearch] = useState('');
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [baseUnitIds, setBaseUnitIds] = useState<string[]>([]);
  const [inputUnitIds, setInputUnitIds] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [metric, setMetric] = useState<OrdersV4ReportMetric>('amount');
  const [ranking, setRanking] = useState<'all' | 'top' | 'bottom'>('all');
  const [rankingCount, setRankingCount] = useState(10);
  const [history, setHistory] = useState<{ itemId?: string; categoryName?: string; title: string } | null>(null);
  const deferredSearch = useDeferredValue(search);
  const activityQuery = useOrdersV4ActivityReport(companyId, documentType, startDate, endDate, {
    search: deferredSearch,
    sectionIds,
    categoryIds,
    itemIds,
    baseUnitIds,
    inputUnitIds,
    paymentMethods: documentType === 'registration' ? [] : paymentMethods as Array<'custody' | 'cash' | 'transfer'>,
    statuses: ['received'],
  });
  const allDocuments = activityQuery.data?.documents ?? [];
  const facets = activityQuery.data?.facets;
  const facetOptions = useMemo(() => ordersV4ReportFacetOptions(facets, documentType, sectionIds, categoryIds), [categoryIds, documentType, facets, sectionIds]);
  const sectionOptions = facetOptions.sections;
  const categoryOptions = facetOptions.categories;
  const itemOptions = facetOptions.items;
  useEffect(() => {
    const validCategories = new Set(categoryOptions.map((entry) => entry.id));
    setCategoryIds((current) => current.filter((id) => validCategories.has(id)));
  }, [categoryOptions]);
  useEffect(() => {
    const validItems = new Set(itemOptions.map((entry) => entry.id));
    setItemIds((current) => current.filter((id) => validItems.has(id)));
  }, [itemOptions]);
  useEffect(() => {
    setSearch(''); setSectionIds([]); setCategoryIds([]); setItemIds([]); setBaseUnitIds([]); setInputUnitIds([]); setPaymentMethods([]);
  }, [companyId]);
  const filteredDocuments = allDocuments;
  const rows = useMemo(() => detailedItems(filteredDocuments), [filteredDocuments]);
  const displayedRows = useMemo(() => {
    if (ranking === 'all') return rows;
    const sorted = [...rows].sort((a, b) => {
      const av = metric === 'amount' ? Number(a.totalAmount) : metric === 'quantity' ? Number(a.baseQuantity) : a.documentCount;
      const bv = metric === 'amount' ? Number(b.totalAmount) : metric === 'quantity' ? Number(b.baseQuantity) : b.documentCount;
      return ranking === 'top' ? bv - av : av - bv;
    });
    return sorted.slice(0, rankingCount);
  }, [metric, ranking, rankingCount, rows]);
  const sectionSummary = useMemo(() => aggregateDocumentsBySection(filteredDocuments).sort((a, b) => metricValue(b, metric) - metricValue(a, metric)), [filteredDocuments, metric]);
  const sectionItems = useMemo(() => topItemsBySection(filteredDocuments), [filteredDocuments]);
  const totals = useMemo(() => ({
    amount: rows.reduce((sum, row) => sum + Number(row.totalAmount), 0),
    quantity: rows.reduce((sum, row) => sum + Number(row.baseQuantity), 0),
    documents: new Set(filteredDocuments.map((row) => row.id)).size,
  }), [filteredDocuments, rows]);
  const loading = activityQuery.isLoading;
  const error = activityQuery.error as Error | null;
  const reset = () => { setSearch(''); setSectionIds([]); setCategoryIds([]); setItemIds([]); setBaseUnitIds([]); setInputUnitIds([]); setPaymentMethods([]); setRanking('all'); setRankingCount(10); };
  const exportRows = displayedRows.map((row) => ({ القسم: row.sections, الصنف: row.nameAr, الفئة: row.categoryName, التغليف: row.inputUnits, 'الكمية المسجلة': row.recordedQuantities, 'وحدة المخزون': row.inventoryUnit, 'الكمية المعيارية': Number(row.baseQuantity), القيمة: Number(row.totalAmount), العمليات: row.documentCount, 'متوسط الوحدة': Number(row.averageUnitCost), 'آخر حركة': row.lastDate }));
  const columns: SimpleTableColumn<DetailedItemRow>[] = [
    { key: 'sections', label: 'القسم', minWidth: 130 },
    { key: 'nameAr', label: 'الصنف', minWidth: 170, render: (value, row) => <Button type="button" variant="ghost" className="font-bold text-blue-700 underline" onClick={(event) => { event.stopPropagation(); setHistory({ itemId: row.itemId, title: row.nameAr }); }}>{String(value)}</Button> },
    { key: 'categoryName', label: 'الفئة', render: (value) => value ? <Button type="button" variant="ghost" className="text-blue-700 underline" onClick={(event) => { event.stopPropagation(); setHistory({ categoryName: String(value), title: String(value) }); }}>{String(value)}</Button> : '—' },
    { key: 'inputUnits', label: 'التغليف / وحدة الإدخال', minWidth: 150 },
    { key: 'recordedQuantities', label: 'الكمية المسجلة', minWidth: 150 },
    { key: 'inventoryUnit', label: 'وحدة المخزون' },
    { key: 'baseQuantity', label: 'الكمية المعيارية', numeric: true, render: (value) => v4ReportNumber(value) },
    { key: 'totalAmount', label: 'القيمة', numeric: true, render: (value) => `${v4ReportNumber(value)} ر.س` },
    { key: 'documentCount', label: 'العمليات', numeric: true },
    { key: 'averageUnitCost', label: 'متوسط السعر', numeric: true, render: (value) => v4ReportNumber(value) },
    { key: 'lastDate', label: 'آخر حركة', render: (value) => v4Date(String(value)) },
  ];
  return <div className="flex flex-col gap-4">
    <OrdersV4Panel title="فلاتر تقرير الأصناف" action={<ReportActions rows={exportRows} filename={`orders-v4-items-${startDate}-${endDate}.xlsx`} title="تقرير أصناف طلبات V4" />}>
      <ReportsFilterBar>
        <OrdersV4Field label="بحث"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="الصنف أو الفئة أو الوحدة…" /></OrdersV4Field>
        <OrdersV4Field label="نوع الحركة"><OrdersV4Select value={documentType} onChange={(event) => { setDocumentType(event.target.value as typeof documentType); reset(); }}><option value="purchase">طلبات الشراء</option><option value="registration">التسجيل الداخلي</option><option value="">كل الحركات</option></OrdersV4Select></OrdersV4Field>
        <OrdersV4Field label="القسم"><SearchableOptionsPicker mode="multiple" values={sectionIds} onChange={setSectionIds} options={sectionOptions.map((section) => ({ value: section.id, label: section.nameAr }))} emptyLabel="كل الأقسام" showClearAll /></OrdersV4Field>
        <OrdersV4Field label="الفئة"><SearchableOptionsPicker mode="multiple" values={categoryIds} onChange={setCategoryIds} options={categoryOptions.map((category) => ({ value: category.id, label: category.nameAr }))} emptyLabel="كل الفئات" showClearAll /></OrdersV4Field>
        <OrdersV4Field label="الصنف"><SearchableOptionsPicker mode="multiple" values={itemIds} onChange={setItemIds} options={itemOptions.map((item) => ({ value: item.id, label: item.nameAr }))} emptyLabel="كل الأصناف" showClearAll /></OrdersV4Field>
        <OrdersV4Field label="وحدة المخزون"><SearchableOptionsPicker mode="multiple" values={baseUnitIds} onChange={setBaseUnitIds} options={(facets?.units ?? []).map((unit) => ({ value: unit.id, label: unit.nameAr }))} emptyLabel="كل الوحدات" showClearAll /></OrdersV4Field>
        <OrdersV4Field label="التغليف / وحدة الإدخال"><SearchableOptionsPicker mode="multiple" values={inputUnitIds} onChange={setInputUnitIds} options={(facets?.units ?? []).map((unit) => ({ value: unit.id, label: unit.nameAr }))} emptyLabel="كل التغليفات" showClearAll /></OrdersV4Field>
        <OrdersV4Field label="طريقة الدفع"><SearchableOptionsPicker mode="multiple" values={paymentMethods} onChange={setPaymentMethods} options={[{ value: 'custody', label: 'عهدة' }, { value: 'cash', label: 'نقد' }, { value: 'transfer', label: 'تحويل' }]} emptyLabel="كل طرق الدفع" showClearAll disabled={documentType === 'registration'} /></OrdersV4Field>
        <OrdersV4Field label="مقياس الرسم والترتيب"><OrdersV4Select value={metric} onChange={(event) => setMetric(event.target.value as OrdersV4ReportMetric)}><option value="amount">المبلغ</option><option value="quantity">الكمية المعيارية</option><option value="documents">عدد العمليات</option></OrdersV4Select></OrdersV4Field>
        <OrdersV4Field label="عرض النتائج"><div className="flex gap-2"><OrdersV4Select value={ranking} onChange={(event) => setRanking(event.target.value as typeof ranking)} className="flex-1"><option value="all">كل النتائج</option><option value="top">الأعلى</option><option value="bottom">الأقل</option></OrdersV4Select>{ranking !== 'all' && <Input type="number" min={1} max={100} value={rankingCount} onChange={(event) => setRankingCount(Math.max(1, Math.min(100, Number(event.target.value) || 10)))} className="w-[72px]" />}<Button size="sm" variant="ghost" onClick={reset}>إعادة ضبط</Button></div></OrdersV4Field>
      </ReportsFilterBar>
    </OrdersV4Panel>
    <OrdersV4QueryState loading={loading} error={error} />
    {!loading && !error && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OrdersV4Kpi label="إجمالي الفترة" value={`${v4ReportNumber(totals.amount)} ر.س`} tone="green" />
        <OrdersV4Kpi label="العمليات الفعلية" value={totals.documents} />
        <OrdersV4Kpi label="الأصناف المختلفة" value={rows.length} />
        <OrdersV4Kpi label="الأقسام الظاهرة" value={sectionSummary.length} tone="amber" />
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <OrdersV4Panel title="مقارنة الأقسام"><HorizontalBars rows={sectionSummary} metric={metric} /></OrdersV4Panel>
        <OrdersV4Panel title={`اتجاه الحركة حسب القسم — ${metricLabel(metric)}`}><TrendChart documents={filteredDocuments} metric={metric} /></OrdersV4Panel>
      </div>
      <OrdersV4Panel title="أعلى الأصناف داخل كل قسم">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sectionItems.map((section, index) => <div key={section.sectionId} className="rounded-xl border border-noorix-border p-3"><div className="mb-3 text-[13px] font-extrabold">{section.sectionName}</div><HorizontalBars rows={section.items.map((item) => ({ id: item.itemId, label: item.nameAr, documents: item.documentCount, quantity: Number(item.baseQuantity), amount: Number(item.totalAmount) }))} metric={metric} color={CHART_COLORS[index % CHART_COLORS.length]} /></div>)}</div>
      </OrdersV4Panel>
      <OrdersV4Panel title="التفاصيل الكاملة"><SmartTable
        columns={columns.map((column) => ({ ...column, align: 'center' }))}
        data={displayedRows}
        emptyMessage="لا توجد حركة مطابقة للفلاتر"
        tableMinWidth={1380}
        footerCells={displayedRows.length ? <><td colSpan={6} className="px-3 py-2 text-center text-[12px] font-bold text-noorix-muted">إجمالي الفلاتر الحالية</td><td className="px-3 py-2 text-center font-bold tabular-nums">{v4ReportNumber(totals.quantity)}</td><td className="px-3 py-2 text-center font-bold text-emerald-700 tabular-nums">{v4ReportNumber(totals.amount)} ر.س</td><td className="px-3 py-2 text-center font-bold tabular-nums">{totals.documents}</td><td colSpan={2} /></> : null}
        renderCompactRow={(row) => <button type="button" className="w-full cursor-pointer text-start" onClick={() => setHistory({ itemId: row.itemId, title: row.nameAr })}><div className="flex items-center justify-between gap-2"><strong className="text-blue-700">{row.nameAr}</strong><strong className="text-emerald-700">{v4ReportNumber(row.totalAmount)} ر.س</strong></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-noorix-muted"><span>{row.sections}</span><span>{row.recordedQuantities}</span><span>معياري: {v4ReportNumber(row.baseQuantity)} {row.inventoryUnit}</span><span>{row.documentCount} عملية</span></div></button>}
        renderMobileCard={(row) => <button type="button" className="flex w-full flex-col gap-1.5 text-start" onClick={() => setHistory({ itemId: row.itemId, title: row.nameAr })}><div className="flex w-full items-center justify-between gap-2"><strong className="text-blue-700">{row.nameAr}</strong><strong className="text-emerald-700">{v4ReportNumber(row.totalAmount)} ر.س</strong></div><div className="text-[11px] text-noorix-muted">{row.categoryName || '—'} · {row.sections}</div><div className="text-[12px]">المسجلة: {row.recordedQuantities}</div><div className="text-[12px]">المعيارية: {v4ReportNumber(row.baseQuantity)} {row.inventoryUnit}</div></button>}
      /></OrdersV4Panel>
    </>}
    {history && <OrdersV4PurchaseHistorySheet documents={allDocuments} itemId={history.itemId} categoryName={history.categoryName} title={history.title} onClose={() => setHistory(null)} />}
  </div>;
}

function statusLabel(status: string): string {
  return status === 'received' ? 'مستلم' : status === 'prepared' ? 'معد' : status === 'cancelled' ? 'ملغي' : status === 'reversed' ? 'معكوس' : status;
}

type InternalView = 'operations' | 'missing' | 'items' | 'sections' | 'employees' | 'daily';
const INTERNAL_REPORT_VIEWS: InternalView[] = ['operations', 'missing', 'items', 'sections', 'employees', 'daily'];

export function OrdersV4SalesReportTab({ companyId, startDate, endDate }: { companyId: string; startDate: string; endDate: string }) {
  const { t, lang } = useTranslation();
  const [activeView, setActiveView] = useTabSearchParam(INTERNAL_REPORT_VIEWS, 'operations', 'ordersV4ReportView', null, undefined, { persistDefault: true });
  const [search, setSearch] = useState('');
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [createdByUserId, setCreatedByUserId] = useState('');
  const [status, setStatus] = useState('received');
  const [entryType, setEntryType] = useState<'issue' | 'cancellation' | ''>('');
  const [cancellationReason, setCancellationReason] = useState<OrdersV4CancellationReason | ''>('');
  const [chartMetric, setChartMetric] = useState<OrdersV4ReportMetric>('quantity');
  const deferredSearch = useDeferredValue(search);
  const query = useOrdersV4SalesReport(companyId, startDate, endDate, {
    search: deferredSearch,
    sectionIds,
    categoryIds,
    itemIds,
    statuses: status ? [status as 'prepared' | 'received' | 'cancelled' | 'reversed'] : [],
    registrationEntryTypes: entryType ? [entryType] : [],
    cancellationReasons: cancellationReason ? [cancellationReason] : [],
  });
  const report = query.data;
  const documents = report?.documents ?? [];
  const facetOptions = useMemo(() => ordersV4ReportFacetOptions(report?.facets, 'registration', sectionIds, categoryIds), [categoryIds, report?.facets, sectionIds]);
  const sections = facetOptions.sections;
  const categoryOptions = facetOptions.categories;
  const itemOptions = facetOptions.items;
  useEffect(() => {
    const valid = new Set(categoryOptions.map((entry) => entry.id));
    setCategoryIds((current) => current.filter((id) => valid.has(id)));
  }, [categoryOptions]);
  useEffect(() => {
    const valid = new Set(itemOptions.map((entry) => entry.id));
    setItemIds((current) => current.filter((id) => valid.has(id)));
  }, [itemOptions]);
  useEffect(() => {
    setSearch(''); setSectionIds([]); setCategoryIds([]); setItemIds([]); setCreatedByUserId(''); setStatus('received'); setEntryType(''); setCancellationReason('');
  }, [companyId]);
  const users = useMemo(() => [...new Map(documents.filter((row) => row.createdByUser).map((row) => [row.createdByUser!.id, row.createdByUser!])).values()].sort((a, b) => v4UserLabel(a).localeCompare(v4UserLabel(b), 'ar')), [documents]);
  const filteredDocuments = useMemo(() => documents.filter((document) => !createdByUserId || document.createdByUser?.id === createdByUserId), [createdByUserId, documents]);
  const byItem = useMemo(() => aggregateItems(filteredDocuments).map((item) => ({
    ...item,
    sections: [...new Set(filteredDocuments.filter((document) => document.lines.some((line) => line.itemId === item.itemId)).map((document) => document.section?.nameAr || 'غير محدد'))].join('، '),
  })), [filteredDocuments]);
  const bySection = useMemo(() => aggregateDocumentsBySection(filteredDocuments), [filteredDocuments]);
  const byEmployee = useMemo(() => aggregateDocumentsByEmployee(filteredDocuments), [filteredDocuments]);
  const byDay = useMemo(() => aggregateDocumentsByDay(filteredDocuments), [filteredDocuments]);
  const missingDays = (report?.registrationCoverage.missingDays ?? []).filter((row) => !sectionIds.length || sectionIds.includes(row.sectionId));
  const totalQuantity = filteredDocuments.reduce((sum, row) => sum + row.lines.reduce((lineSum, line) => lineSum + Number(line.baseQuantity || 0), 0), 0);
  const totalAmount = filteredDocuments.reduce((sum, row) => sum + Number(row.operationalCost || 0), 0);
  const affectedSections = new Set(missingDays.map((row) => row.sectionId)).size;
  const exportRows = filteredDocuments.map((row) => ({ المرجع: row.documentNumber, التاريخ: row.documentDate, النوع: (row.registrationEntryType ?? 'issue') === 'cancellation' ? 'إلغاء' : 'تسجيل', القسم: row.section?.nameAr || '', الموظف: v4UserLabel(row.createdByUser), الأصناف: row.lines.length, الكمية: row.lines.reduce((sum, line) => sum + Number(line.baseQuantity || 0), 0), التكلفة: Number(row.operationalCost || 0), الحالة: statusLabel(row.status) }));
  const itemColumns: SimpleTableColumn<(typeof byItem)[number]>[] = [
    { key: 'nameAr', label: 'الصنف', minWidth: 170 }, { key: 'categoryName', label: 'الفئة' }, { key: 'sections', label: 'الأقسام', minWidth: 140 }, { key: 'documentCount', label: 'التسجيلات', numeric: true },
    { key: 'baseQuantity', label: 'الكمية المعيارية', numeric: true, render: (value, row) => `${v4ReportNumber(value)} ${row.inventoryUnit}` },
    { key: 'totalAmount', label: 'التكلفة', numeric: true, render: (value) => `${v4ReportNumber(value)} ر.س` },
  ];
  const sectionColumns: SimpleTableColumn<(typeof bySection)[number]>[] = [
    { key: 'label', label: 'القسم' }, { key: 'documents', label: 'التسجيلات', numeric: true }, { key: 'quantity', label: 'الكمية', numeric: true, render: v4ReportNumber }, { key: 'amount', label: 'التكلفة', numeric: true, render: (value) => `${v4ReportNumber(value)} ر.س` }, { key: 'average', label: 'متوسط العملية', numeric: true, render: (_value, row) => `${v4ReportNumber(row.documents ? row.amount / row.documents : 0)} ر.س` },
  ];
  const employeeColumns: SimpleTableColumn<(typeof byEmployee)[number]>[] = [
    { key: 'label', label: 'اسم الموظف' }, { key: 'username', label: 'اسم المستخدم', render: (value) => String(value || '—').split('@')[0] }, { key: 'documents', label: 'التسجيلات', numeric: true }, { key: 'quantity', label: 'الكمية', numeric: true, render: v4ReportNumber }, { key: 'amount', label: 'التكلفة', numeric: true, render: (value) => `${v4ReportNumber(value)} ر.س` },
  ];
  const dailyColumns: SimpleTableColumn<(typeof byDay)[number]>[] = [
    { key: 'date', label: 'التاريخ', render: (value) => v4Date(String(value)) }, { key: 'documents', label: 'التسجيلات', numeric: true }, { key: 'quantity', label: 'الكمية', numeric: true, render: v4ReportNumber }, { key: 'amount', label: 'التكلفة', numeric: true, render: (value) => `${v4ReportNumber(value)} ر.س` },
  ];
  const missingColumns: SimpleTableColumn<(typeof missingDays)[number]>[] = [
    { key: 'date', label: 'التاريخ', render: (value) => v4Date(String(value)) }, { key: 'sectionName', label: 'القسم' }, { key: 'status', label: 'الحالة', render: () => <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">لم يسجل</span> },
  ];
  const documentColumns: SimpleTableColumn<OrdersV4Document>[] = [
    { key: 'documentNumber', label: 'مرجع العملية', minWidth: 170 }, { key: 'documentDate', label: 'التاريخ', render: (value) => v4Date(String(value)) },
    { key: 'registrationEntryType', label: 'النوع', render: (_value, row) => (row.registrationEntryType ?? 'issue') === 'cancellation' ? <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700">إلغاء</span> : 'تسجيل داخلي' },
    { key: 'section', label: 'القسم', render: (_value, row) => row.section?.nameAr || '—' }, { key: 'createdByUser', label: 'الموظف (المستخدم)', minWidth: 180, render: (_value, row) => v4UserLabel(row.createdByUser) },
    { key: 'lines', label: 'الأصناف', numeric: true, render: (_value, row) => row.lines.length }, { key: 'quantity', label: 'الكمية', numeric: true, render: (_value, row) => v4ReportNumber(row.lines.reduce((sum, line) => sum + Number(line.baseQuantity || 0), 0)) }, { key: 'operationalCost', label: 'التكلفة', numeric: true, render: (value) => `${v4ReportNumber(value)} ر.س` }, { key: 'average', label: 'متوسط تكلفة الصنف', numeric: true, render: (_value, row) => `${v4ReportNumber(row.lines.length ? Number(row.operationalCost || 0) / row.lines.length : 0)} ر.س` }, { key: 'status', label: 'الحالة', render: (value) => statusLabel(String(value)) },
    { key: 'cancellationReasons', label: 'أسباب الإلغاء', minWidth: 220, render: (_value, row) => { const reasons = [...new Set(row.lines.flatMap((line) => line.cancellationReasons ?? []))]; return reasons.length ? reasons.map((reason) => ordersV4CancellationReasonLabel(reason, t)).join(lang === 'en' ? ', ' : '، ') : '—'; } },
  ];
  return <div className="flex flex-col gap-4">
    <OrdersV4Panel title="فلاتر التقرير الداخلي" action={<ReportActions rows={exportRows} filename={`orders-v4-internal-${startDate}-${endDate}.xlsx`} title="تقرير التسجيل الداخلي V4" />}>
      <ReportsFilterBar>
        <OrdersV4Field label="بحث"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="مرجع أو صنف أو موظف…" /></OrdersV4Field>
        <OrdersV4Field label="القسم"><SearchableOptionsPicker mode="multiple" values={sectionIds} onChange={setSectionIds} options={sections.map((section) => ({ value: section.id, label: section.nameAr }))} emptyLabel="كل الأقسام" showClearAll /></OrdersV4Field>
        <OrdersV4Field label="الفئة"><SearchableOptionsPicker mode="multiple" values={categoryIds} onChange={setCategoryIds} options={categoryOptions.map((category) => ({ value: category.id, label: category.nameAr }))} emptyLabel="كل الفئات" showClearAll /></OrdersV4Field>
        <OrdersV4Field label="الصنف"><SearchableOptionsPicker mode="multiple" values={itemIds} onChange={setItemIds} options={itemOptions.map((item) => ({ value: item.id, label: item.nameAr }))} emptyLabel="كل الأصناف" showClearAll /></OrdersV4Field>
        <OrdersV4Field label="الموظف"><OrdersV4Select value={createdByUserId} onChange={(event) => setCreatedByUserId(event.target.value)}><option value="">كل الموظفين</option>{users.map((user) => <option key={user.id} value={user.id}>{v4UserLabel(user)}</option>)}</OrdersV4Select></OrdersV4Field>
        <OrdersV4Field label="الحالة"><OrdersV4Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">كل الحالات</option><option value="received">مستلم</option><option value="prepared">معد</option><option value="cancelled">ملغي</option><option value="reversed">معكوس</option></OrdersV4Select></OrdersV4Field>
        <OrdersV4Field label={t('ordersV4CancellationRecordType')}><OrdersV4Select value={entryType} onChange={(event) => setEntryType(event.target.value as typeof entryType)}><option value="">كل السجلات</option><option value="issue">تسجيل داخلي</option><option value="cancellation">تسجيل إلغاء</option></OrdersV4Select></OrdersV4Field>
        <OrdersV4Field label={t('staffCancellationReasons')}><OrdersV4Select value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value as OrdersV4CancellationReason | '')}><option value="">كل الأسباب</option>{ORDERS_V4_CANCELLATION_REASON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.translationKey)}</option>)}</OrdersV4Select></OrdersV4Field>
        <div className="flex items-end"><Button size="sm" variant="ghost" onClick={() => { setSearch(''); setSectionIds([]); setCategoryIds([]); setItemIds([]); setCreatedByUserId(''); setStatus('received'); setEntryType(''); setCancellationReason(''); }}>إعادة ضبط الفلاتر</Button></div>
      </ReportsFilterBar>
    </OrdersV4Panel>
    <OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} onRetry={() => { void query.refetch(); }} retrying={query.isFetching} />
    {!query.isLoading && !query.error && <>
      <div className={`rounded-xl border px-4 py-3 ${missingDays.length ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[14px] font-extrabold">انضباط التسجيل اليومي</div><div className="mt-1 text-[12px] text-noorix-muted">{!report?.registrationCoverage.sections.length ? 'تظهر التغطية بعد بدء التسجيل ووجود أقسام نشطة.' : missingDays.length ? `يوجد ${missingDays.length} يوم/قسم بلا تسجيل في ${affectedSections} قسم.` : 'التسجيل مكتمل لكل الأقسام النشطة خلال الفترة.'}</div></div><div className="flex gap-2"><div className="rounded-lg bg-white px-4 py-2 text-center"><div className="text-[20px] font-extrabold text-amber-700">{missingDays.length}</div><div className="text-[10px] text-noorix-muted">أيام/أقسام ناقصة</div></div><div className="rounded-lg bg-white px-4 py-2 text-center"><div className="text-[20px] font-extrabold text-blue-700">{affectedSections}</div><div className="text-[10px] text-noorix-muted">أقسام متأثرة</div></div></div></div>
      </div>
      {report?.costCoverage.zeroCostLines ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">تنبيه جودة التكلفة: {report.costCoverage.zeroCostLines} من {report.costCoverage.lines} سطر تكلفتها التشغيلية صفر. الكميات والحركات صحيحة، لكن تقارير التكلفة تحتاج استكمال أسعار المكونات أو الرسبي.</div> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <OrdersV4Kpi label="العمليات" value={filteredDocuments.length} /><OrdersV4Kpi label="إجمالي الكميات" value={v4ReportNumber(totalQuantity)} tone="green" /><OrdersV4Kpi label="إجمالي التكلفة" value={`${v4ReportNumber(totalAmount)} ر.س`} tone="green" /><OrdersV4Kpi label="متوسط العملية" value={`${v4ReportNumber(filteredDocuments.length ? totalAmount / filteredDocuments.length : 0)} ر.س`} /><OrdersV4Kpi label="الأصناف" value={byItem.length} /><OrdersV4Kpi label="الأقسام" value={bySection.length} tone="amber" />
      </div>
      <OrdersV4Panel
        title={`الاتجاه اليومي للتسجيل حسب القسم — ${metricLabel(chartMetric)}`}
        action={<div className="flex max-w-full gap-1 overflow-x-auto print:hidden">
          {([
            { id: 'quantity', label: 'الكمية' },
            { id: 'documents', label: 'العمليات' },
            { id: 'amount', label: 'التكلفة' },
          ] as Array<{ id: OrdersV4ReportMetric; label: string }>).map((option) => <Button
            key={option.id}
            type="button"
            size="sm"
            variant={chartMetric === option.id ? 'primary' : 'ghost'}
            className="shrink-0 whitespace-nowrap"
            onClick={() => setChartMetric(option.id)}
          >{option.label}</Button>)}
        </div>}
      ><TrendChart documents={filteredDocuments} metric={chartMetric} /></OrdersV4Panel>
      <ReportViewTabs value={activeView} onChange={setActiveView} items={[{ id: 'operations', label: 'بالعملية' }, { id: 'missing', label: `أيام بلا تسجيل (${missingDays.length})` }, { id: 'items', label: 'بالصنف' }, { id: 'sections', label: 'بالقسم' }, { id: 'employees', label: 'بالموظف' }, { id: 'daily', label: 'يومياً' }]} />
      <OrdersV4Panel title={activeView === 'operations' ? 'سجل العمليات' : activeView === 'missing' ? 'أيام بلا تسجيل' : activeView === 'items' ? 'التسجيل حسب الصنف' : activeView === 'sections' ? 'التسجيل حسب القسم' : activeView === 'employees' ? 'التسجيل حسب الموظف' : 'التسجيل اليومي'}>
        {activeView === 'operations' && <SmartTable
          columns={documentColumns.map((column) => ({ ...column, align: 'center' }))}
          data={filteredDocuments}
          emptyMessage="لا توجد تسجيلات مطابقة"
          tableMinWidth={1380}
          footerCells={filteredDocuments.length ? <><td colSpan={6} className="px-3 py-2 text-center text-[12px] font-bold text-noorix-muted">إجمالي الفلاتر الحالية</td><td className="px-3 py-2 text-center font-bold tabular-nums">{v4ReportNumber(totalQuantity)}</td><td className="px-3 py-2 text-center font-bold text-emerald-700 tabular-nums">{v4ReportNumber(totalAmount)} ر.س</td><td className="px-3 py-2 text-center font-bold tabular-nums">{v4ReportNumber(filteredDocuments.length ? totalAmount / filteredDocuments.length : 0)} ر.س</td><td colSpan={2} /></> : null}
          renderCompactRow={(row) => <div><div className="flex items-center justify-between gap-2"><strong>{row.documentNumber}</strong><strong className="text-emerald-700">{v4ReportNumber(row.operationalCost)} ر.س</strong></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-noorix-muted"><span>{v4Date(row.documentDate)}</span><span>{row.section?.nameAr || 'غير محدد'}</span><span>{v4UserLabel(row.createdByUser)}</span><span>{row.lines.length} صنف</span></div></div>}
          renderMobileCard={(row) => <div className="flex flex-col gap-1.5"><div className="flex items-center justify-between gap-2"><strong>{row.documentNumber}</strong><strong className="text-emerald-700">{v4ReportNumber(row.operationalCost)} ر.س</strong></div><div className="text-[11px] text-noorix-muted">{v4Date(row.documentDate)} · {row.section?.nameAr || 'غير محدد'}</div><div className="text-[12px]">{v4UserLabel(row.createdByUser)} · {row.lines.length} صنف · {v4ReportNumber(row.lines.reduce((sum, line) => sum + Number(line.baseQuantity || 0), 0))}</div></div>}
        />}
        {activeView === 'missing' && <SimpleTable columns={missingColumns} data={missingDays} emptyMessage="لا توجد أيام ناقصة خلال الفترة" />}
        {activeView === 'items' && <SimpleTable columns={itemColumns} data={byItem} emptyMessage="لا توجد بيانات مطابقة" tableMinWidth={700} />}
        {activeView === 'sections' && <SimpleTable columns={sectionColumns} data={bySection} emptyMessage="لا توجد بيانات مطابقة" />}
        {activeView === 'employees' && <SimpleTable columns={employeeColumns} data={byEmployee} emptyMessage="لا توجد بيانات مطابقة" tableMinWidth={700} />}
        {activeView === 'daily' && <SimpleTable columns={dailyColumns} data={byDay} emptyMessage="لا توجد بيانات مطابقة" />}
      </OrdersV4Panel>
    </>}
  </div>;
}
