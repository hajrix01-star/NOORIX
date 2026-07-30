import React, { useMemo, useState } from 'react';
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
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import {
  useCategoryPurchaseHistoryRange,
  useOrderSections,
  useOrdersItemsReportRange,
  useProductPurchaseHistoryRange,
} from '../../../hooks/useOrders';
import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { DateFilterBar } from '../../../ui/date';
import { exportToExcel } from '../../../utils/exportUtils';
import { buildPrintTableHtml } from '../../../utils/printTableHtml';
import {
  AdaptiveSheet,
  Button,
  DataBar,
  FilterToolbar,
  FmtNum,
  Input,
  MetricCard,
  SearchableOptionsPicker,
  SimpleTable,
  SmartTable,
  usePrintPreview,
} from '../../../ui';
import type { OrderItemsReportRow, OrderPurchaseHistoryRow } from '../../../types/api';
import {
  aggregateProducts,
  buildDailySectionSeries,
  buildReconciledSectionSummaries,
  computeItemsReportMetrics,
  filterItemsReportRows,
  metricValue,
  rankItemsReportRows,
  rowsForSection,
  type ItemsReportMetric,
  type ItemsReportRanking,
} from '../utils/itemsReportViewModel';

const CHART_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777'];
const SHARED_SECTION = 'مشترك';
const UNASSIGNED_SECTION = 'غير محدد';

type ChartItem = {
  key: string;
  label: string;
  value: number;
};

function HorizontalBars({
  items,
  color = '#2563eb',
  emptyLabel,
  valueSuffix,
}: {
  items: ChartItem[];
  color?: string;
  emptyLabel: string;
  valueSuffix?: string;
}) {
  if (items.length === 0) {
    return <div className="py-8 text-center text-[12px] text-noorix-muted">{emptyLabel}</div>;
  }
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.key} className="grid grid-cols-[minmax(90px,1fr)_minmax(100px,2fr)_auto] items-center gap-2">
          <span className="truncate text-[12px] font-medium" title={item.label}>{item.label}</span>
          <div className="h-5 overflow-hidden rounded bg-noorix-bg-muted">
            <DataBar
              className="h-full rounded transition-[width] duration-300"
              widthPercent={(item.value / maxValue) * 100}
              color={color}
            />
          </div>
          <span className="min-w-[64px] text-left text-[11px] nx-font-numbers">
            {fmt(item.value, item.value % 1 === 0 ? 0 : 2)}{valueSuffix ? ` ${valueSuffix}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function PurchaseHistoryModal({
  companyId,
  startDate,
  endDate,
  product,
  category,
  onClose,
  t,
}: {
  companyId: string;
  startDate: string;
  endDate: string;
  product?: OrderItemsReportRow | null;
  category?: { id?: string; nameAr?: string | null; nameEn?: string | null } | null;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const isProduct = Boolean(product);
  const productId = product?.id ?? product?.productId ?? '';
  const categoryId = category?.id ?? '';
  const { data: productHistory = [], isLoading: productLoading } = useProductPurchaseHistoryRange(
    companyId,
    productId,
    startDate,
    endDate,
    isProduct,
  );
  const { data: categoryHistory = [], isLoading: categoryLoading } = useCategoryPurchaseHistoryRange(
    companyId,
    categoryId,
    startDate,
    endDate,
    !isProduct,
  );
  const history: OrderPurchaseHistoryRow[] = isProduct ? productHistory : categoryHistory;
  const isLoading = isProduct ? productLoading : categoryLoading;
  const title = isProduct
    ? (product?.productNameAr || product?.nameAr || product?.productNameEn || productId)
    : (category?.nameAr || category?.nameEn || categoryId);

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={`${t('ordersPurchaseHistory')} — ${title}`}
      size="md"
      side="start"
      className="orders-purchase-history-drawer"
    >
      {isLoading ? (
        <div className="p-10 text-center text-noorix-muted">{t('loading')}</div>
      ) : history.length === 0 ? (
        <div className="p-10 text-center text-noorix-muted">{t('ordersNoPurchaseHistory')}</div>
      ) : (
        <SimpleTable
          data={history}
          tableMinWidth={420}
          columns={[
            { key: 'orderNumber', label: t('orderNumber'), align: 'right' },
            {
              key: 'orderDate',
              label: t('orderDate'),
              align: 'right',
              render: (_value: unknown, row: OrderPurchaseHistoryRow) => formatSaudiDate(row.orderDate),
            },
            { key: 'quantity', label: t('quantity'), numeric: true, render: (_value: unknown, row: OrderPurchaseHistoryRow) => fmt(row.quantity) },
            { key: 'unitPrice', label: t('unitPrice'), numeric: true, render: (_value: unknown, row: OrderPurchaseHistoryRow) => <FmtNum n={row.unitPrice} /> },
            {
              key: 'amount',
              label: t('total'),
              numeric: true,
              cellClassName: 'nx-cell-num--green',
              render: (_value: unknown, row: OrderPurchaseHistoryRow) => <><FmtNum n={row.amount} /> SR</>,
            },
          ]}
        />
      )}
    </AdaptiveSheet>
  );
}

export function ItemsReportTab({
  companyId,
  year,
  month,
  startDate: propStartDate,
  endDate: propEndDate,
  dateFilter,
}: {
  companyId: string;
  year: number;
  month: number;
  startDate?: string;
  endDate?: string;
  dateFilter: React.ComponentProps<typeof DateFilterBar>['filter'];
}) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const copy = lang === 'ar' ? {
    search: 'بحث باسم الصنف أو الفئة…',
    section: 'القسم',
    allSections: 'كل الأقسام',
    category: 'الفئة',
    allCategories: 'كل الفئات',
    unit: 'الوحدة',
    allUnits: 'كل الوحدات',
    packaging: 'التغليف',
    allPackaging: 'كل التغليفات',
    orderType: 'نوع الطلب',
    allOrderTypes: 'كل أنواع الطلبات',
    external: 'خارجي',
    internal: 'داخلي',
    metric: 'مقياس الرسم والترتيب',
    amount: 'المبلغ',
    normalizedQuantity: 'الكمية المعيارية',
    orderCount: 'عدد الطلبات',
    ranking: 'عرض النتائج',
    all: 'كل النتائج',
    top: 'الأعلى',
    bottom: 'الأقل',
    reset: 'إعادة ضبط',
    filteredPeriod: 'حسب الفترة والفلاتر الحالية',
    distinctOrders: 'الطلبات الفعلية',
    distinctProducts: 'الأصناف المختلفة',
    activeSections: 'الأقسام الظاهرة',
    sectionComparison: 'مقارنة الأقسام',
    sectionComparisonHint: 'الأصناف متعددة الأقسام تظهر تحت «مشترك» لمنع مضاعفة الإجماليات.',
    sectionCharts: 'أعلى الأصناف داخل كل قسم',
    trend: 'اتجاه الحركة حسب القسم',
    noData: 'لا توجد بيانات ضمن الفلاتر الحالية',
    rawQuantity: 'الكمية المسجلة',
    baseQuantity: 'الكمية المعيارية',
    averagePrice: 'متوسط السعر',
    lastPurchase: 'آخر شراء',
    sizePackaging: 'الحجم / التغليف',
    currentFiltersTotal: 'إجمالي الفلاتر الحالية',
    mixedUnits: 'وحدات متعددة',
    shared: 'مشترك',
    unassigned: 'غير محدد',
  } : {
    search: 'Search item or category…',
    section: 'Section',
    allSections: 'All sections',
    category: 'Category',
    allCategories: 'All categories',
    unit: 'Unit',
    allUnits: 'All units',
    packaging: 'Packaging',
    allPackaging: 'All packaging',
    orderType: 'Order type',
    allOrderTypes: 'All order types',
    external: 'External',
    internal: 'Internal',
    metric: 'Chart and ranking metric',
    amount: 'Amount',
    normalizedQuantity: 'Normalized quantity',
    orderCount: 'Orders',
    ranking: 'Result view',
    all: 'All results',
    top: 'Top',
    bottom: 'Bottom',
    reset: 'Reset',
    filteredPeriod: 'Current period and filters',
    distinctOrders: 'Distinct orders',
    distinctProducts: 'Distinct items',
    activeSections: 'Visible sections',
    sectionComparison: 'Section comparison',
    sectionComparisonHint: 'Multi-section items are grouped as Shared to prevent double counting.',
    sectionCharts: 'Top items in each section',
    trend: 'Activity trend by section',
    noData: 'No data for the current filters',
    rawQuantity: 'Recorded quantity',
    baseQuantity: 'Normalized quantity',
    averagePrice: 'Average price',
    lastPurchase: 'Last purchase',
    sizePackaging: 'Size / packaging',
    currentFiltersTotal: 'Current filter total',
    mixedUnits: 'Multiple units',
    shared: 'Shared',
    unassigned: 'Unassigned',
  };

  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('ordersItemsReportTab'),
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });
  const [search, setSearch] = useState('');
  const [sectionFilters, setSectionFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [unitFilters, setUnitFilters] = useState<string[]>([]);
  const [packagingFilters, setPackagingFilters] = useState<string[]>([]);
  const [orderTypeFilters, setOrderTypeFilters] = useState<string[]>([]);
  const [metric, setMetric] = useState<ItemsReportMetric>('amount');
  const [ranking, setRanking] = useState<ItemsReportRanking>('all');
  const [rankingCount, setRankingCount] = useState(10);
  const [historyModal, setHistoryModal] = useState<{
    product?: OrderItemsReportRow;
    category?: { id?: string; nameAr?: string | null; nameEn?: string | null };
  } | null>(null);

  const startDate = propStartDate || `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = propEndDate || `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const { data: reportResult, isLoading } = useOrdersItemsReportRange(companyId, startDate, endDate);
  const { data: catalogSections = [] } = useOrderSections(companyId);
  const report = reportResult?.rows ?? [];

  const filters = useMemo(() => ({
    search,
    sections: sectionFilters,
    categoryIds: categoryFilters,
    units: unitFilters,
    packagings: packagingFilters,
    orderTypes: orderTypeFilters,
  }), [categoryFilters, orderTypeFilters, packagingFilters, search, sectionFilters, unitFilters]);

  const filtered = useMemo(() => filterItemsReportRows(report, filters), [filters, report]);
  const displayed = useMemo(
    () => rankItemsReportRows(filtered, metric, ranking, rankingCount),
    [filtered, metric, ranking, rankingCount],
  );
  const totals = useMemo(() => computeItemsReportMetrics(filtered), [filtered]);
  const sectionSummaries = useMemo(
    () => buildReconciledSectionSummaries(filtered)
      .sort((a, b) => metricValue(b, metric) - metricValue(a, metric)),
    [filtered, metric],
  );
  const trendData = useMemo(() => buildDailySectionSeries(filtered, metric), [filtered, metric]);

  const sectionOptions = useMemo(() => {
    const values = new Set(catalogSections.map((section) => section.nameAr).filter(Boolean));
    for (const row of report) {
      for (const section of row.sectionNames || []) values.add(section);
      if ((!row.sectionNames || row.sectionNames.length === 0) && row.sectionName) values.add(row.sectionName);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, lang === 'ar' ? 'ar' : 'en'))
      .map((value) => ({ value, label: value }));
  }, [catalogSections, lang, report]);

  const categoryOptions = useMemo(() => {
    const scopedRows = sectionFilters.length === 0
      ? report
      : report.filter((row) => sectionFilters.some((section) => (row.sectionNames || [row.sectionName || '']).includes(section)));
    const values = new Map<string, string>();
    for (const row of scopedRows) {
      if (!row.categoryId) continue;
      values.set(row.categoryId, row.categoryNameAr || row.categoryNameEn || '—');
    }
    return Array.from(values, ([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, lang === 'ar' ? 'ar' : 'en'));
  }, [lang, report, sectionFilters]);

  const unitOptions = useMemo(() => Array.from(new Set(report.map((row) => row.unit).filter(Boolean) as string[]))
    .sort().map((value) => ({ value, label: value })), [report]);
  const packagingOptions = useMemo(() => Array.from(new Set(report.map((row) => row.packaging).filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b, lang === 'ar' ? 'ar' : 'en'))
    .map((value) => ({ value, label: value })), [lang, report]);

  const sectionNamesForCards = useMemo(() => {
    if (sectionFilters.length > 0) return sectionFilters;
    const names = sectionOptions.map((option) => option.value);
    for (const special of [SHARED_SECTION, UNASSIGNED_SECTION]) {
      if (sectionSummaries.some((summary) => summary.sectionName === special) && !names.includes(special)) names.push(special);
    }
    return names;
  }, [sectionFilters, sectionOptions, sectionSummaries]);

  const metricLabel = metric === 'amount'
    ? copy.amount
    : metric === 'normalizedQuantity'
      ? copy.normalizedQuantity
      : copy.orderCount;
  const metricSuffix = metric === 'amount' ? 'SR' : undefined;
  const comparisonItems = sectionSummaries.map((summary) => ({
    key: summary.sectionName,
    label: summary.sectionName,
    value: metricValue(summary, metric),
  }));
  const trendSections = sectionSummaries.map((summary) => summary.sectionName);

  const resetFilters = () => {
    setSearch('');
    setSectionFilters([]);
    setCategoryFilters([]);
    setUnitFilters([]);
    setPackagingFilters([]);
    setOrderTypeFilters([]);
    setMetric('amount');
    setRanking('all');
    setRankingCount(10);
  };

  const exportRows = () => displayed.map((row) => ({
    [copy.section]: (row.sectionNames || [row.sectionName]).filter(Boolean).join('، ') || copy.unassigned,
    [t('product')]: row.productNameAr || row.productNameEn || '—',
    [t('category')]: row.categoryNameAr || row.categoryNameEn || '—',
    [copy.sizePackaging]: [row.size, row.packaging].filter(Boolean).join(' / ') || '—',
    [copy.unit]: row.unit || '—',
    [copy.rawQuantity]: fmt(row.quantity),
    [copy.baseQuantity]: `${fmt(row.normalizedQuantity ?? row.quantity)} ${row.baseUnit || row.unit || ''}`.trim(),
    [t('total')]: fmt(row.amount),
    [copy.distinctOrders]: row.orderCount,
    [copy.averagePrice]: fmt(row.averageUnitPrice ?? 0),
    [copy.lastPurchase]: row.lastOrderDate ? formatSaudiDate(row.lastOrderDate) : '—',
  }));

  const handleExportExcel = async () => {
    try {
      await exportToExcel(exportRows(), `orders-items-report-${startDate}-${endDate}.xlsx`);
      showToast(t('exportSuccess'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('exportFailed'), 'error');
    }
  };

  const handlePrintPdf = () => {
    try {
      const rows = exportRows();
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      openPrintDocumentPreview({
        title: `${t('ordersItemsReportTab')} - ${startDate} / ${endDate}`,
        subtitle: `${copy.filteredPeriod} — ${displayed.length}`,
        landscape: true,
        body: buildPrintTableHtml({
          columns: columns.map((label, index) => ({ key: String(index), header: label })),
          rows: rows.map((row) => columns.reduce<Record<string, unknown>>((accumulator, label, index) => {
            accumulator[String(index)] = row[label] ?? '';
            return accumulator;
          }, {})),
        }),
      });
      showToast(t('exportSuccess'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('exportFailed'), 'error');
    }
  };

  const normalizedTotal = totals.quantityByBaseUnit.size === 1
    ? Array.from(totals.quantityByBaseUnit.entries())[0]
    : null;

  return (
    <div className="nx-orders-tab-root flex flex-col gap-3 sm:gap-4">
      {printPreviewModal}
      <FilterToolbar
        className="nx-page-header nx-page-header--filter-row"
        actions={(
          <>
            <Button type="button" size="sm" onClick={handleExportExcel} disabled={displayed.length === 0}>Excel</Button>
            <Button type="button" size="sm" onClick={handlePrintPdf} disabled={displayed.length === 0}>{t('print')} / PDF</Button>
          </>
        )}
      >
        <DateFilterBar filter={dateFilter} />
      </FilterToolbar>

      <div className="noorix-print-hide rounded-xl border border-noorix-border bg-noorix-surface p-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            value={search}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
            placeholder={copy.search}
            aria-label={copy.search}
          />
          <SearchableOptionsPicker
            mode="multiple"
            values={sectionFilters}
            onChange={setSectionFilters}
            options={sectionOptions}
            emptyLabel={copy.allSections}
            aria-label={copy.section}
            showClearAll
          />
          <SearchableOptionsPicker
            mode="multiple"
            values={categoryFilters}
            onChange={setCategoryFilters}
            options={categoryOptions}
            emptyLabel={copy.allCategories}
            aria-label={copy.category}
            showClearAll
          />
          <SearchableOptionsPicker
            mode="multiple"
            values={unitFilters}
            onChange={setUnitFilters}
            options={unitOptions}
            emptyLabel={copy.allUnits}
            aria-label={copy.unit}
            showClearAll
          />
          <SearchableOptionsPicker
            mode="multiple"
            values={packagingFilters}
            onChange={setPackagingFilters}
            options={packagingOptions}
            emptyLabel={copy.allPackaging}
            aria-label={copy.packaging}
            showClearAll
          />
          <SearchableOptionsPicker
            mode="multiple"
            values={orderTypeFilters}
            onChange={setOrderTypeFilters}
            options={[
              { value: 'external', label: copy.external },
              { value: 'internal', label: copy.internal },
            ]}
            emptyLabel={copy.allOrderTypes}
            aria-label={copy.orderType}
            showClearAll
          />
          <SearchableOptionsPicker
            value={metric}
            onChange={(value) => setMetric(value as ItemsReportMetric)}
            options={[
              { value: 'amount', label: copy.amount },
              { value: 'normalizedQuantity', label: copy.normalizedQuantity },
              { value: 'orderCount', label: copy.orderCount },
            ]}
            aria-label={copy.metric}
          />
          <div className="flex gap-2">
            <SearchableOptionsPicker
              className="flex-1"
              value={ranking}
              onChange={(value) => setRanking(value as ItemsReportRanking)}
              options={[
                { value: 'all', label: copy.all },
                { value: 'top', label: copy.top },
                { value: 'bottom', label: copy.bottom },
              ]}
              aria-label={copy.ranking}
            />
            {ranking !== 'all' && (
              <Input
                type="number"
                min={1}
                max={100}
                value={rankingCount}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRankingCount(
                  Math.max(1, Math.min(100, Number.parseInt(event.target.value, 10) || 10)),
                )}
                className="w-[76px]"
                aria-label={copy.ranking}
              />
            )}
            <Button type="button" variant="ghost" onClick={resetFilters}>{copy.reset}</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard color="var(--color-nx-profit)">
          <MetricCard.Header label={t('ordersTotalAmount')} subLabel={copy.filteredPeriod} />
          <MetricCard.Value value={totals.amount} currency="SR" color="var(--color-nx-profit)" />
        </MetricCard>
        <MetricCard color="var(--noorix-accent-blue)">
          <MetricCard.Header label={copy.distinctOrders} subLabel={copy.filteredPeriod} />
          <MetricCard.Value value={totals.distinctOrders} />
        </MetricCard>
        <MetricCard color="var(--noorix-accent-green)">
          <MetricCard.Header label={copy.distinctProducts} subLabel={copy.filteredPeriod} />
          <MetricCard.Value value={totals.distinctProducts} />
        </MetricCard>
        <MetricCard color="var(--noorix-accent-amber)">
          <MetricCard.Header label={copy.activeSections} subLabel={copy.filteredPeriod} />
          <MetricCard.Value value={totals.sectionsCount} />
        </MetricCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-noorix-border bg-noorix-surface p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold">{copy.sectionComparison}</h3>
            <span className="text-[11px] text-noorix-muted">{metricLabel}</span>
          </div>
          <p className="mb-4 text-[11px] text-noorix-muted">{copy.sectionComparisonHint}</p>
          <HorizontalBars items={comparisonItems} emptyLabel={copy.noData} valueSuffix={metricSuffix} />
        </section>

        <section className="rounded-xl border border-noorix-border bg-noorix-surface p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold">{copy.trend}</h3>
            <span className="text-[11px] text-noorix-muted">{metricLabel}</span>
          </div>
          {trendData.length === 0 ? (
            <div className="py-20 text-center text-[12px] text-noorix-muted">{copy.noData}</div>
          ) : (
            <div className="h-[280px] min-w-0" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" />
                  <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} fontSize={11} />
                  <YAxis width={54} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  {trendSections.map((section, index) => (
                    <Line
                      key={section}
                      type="monotone"
                      dataKey={section}
                      name={section}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-3 sm:bg-noorix-surface sm:p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-[14px] font-bold">{copy.sectionCharts}</h3>
          <span className="text-[11px] text-noorix-muted">{metricLabel}</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {sectionNamesForCards.map((sectionName, sectionIndex) => {
            const productRows = aggregateProducts(rowsForSection(filtered, sectionName))
              .sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
              .slice(0, 5);
            const items = productRows.map((row) => ({
              key: row.productId,
              label: row.productNameAr || row.productNameEn || '—',
              value: metricValue(row, metric),
            }));
            return (
              <article key={sectionName} className="rounded-lg border border-noorix-border bg-noorix-surface p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-[13px] font-bold">{sectionName}</h4>
                  <span className="text-[10px] text-noorix-muted">{productRows.length} / 5</span>
                </div>
                <HorizontalBars
                  items={items}
                  emptyLabel={copy.noData}
                  valueSuffix={metricSuffix}
                  color={CHART_COLORS[sectionIndex % CHART_COLORS.length]}
                />
              </article>
            );
          })}
        </div>
      </section>

      <SmartTable
        columns={[
          {
            key: 'sectionName',
            label: copy.section,
            render: (_value: unknown, row: OrderItemsReportRow) => (
              <span className="text-[12px]">{(row.sectionNames || [row.sectionName]).filter(Boolean).join('، ') || copy.unassigned}</span>
            ),
          },
          {
            key: 'productNameAr',
            label: t('product'),
            render: (_value: unknown, row: OrderItemsReportRow) => (
              <Button
                variant="ghost"
                type="button"
                onClick={() => setHistoryModal({ product: { ...row, id: row.productId } })}
                className="text-[13px] font-semibold text-noorix-blue underline"
              >
                {row.productNameAr || row.productNameEn || '—'}
              </Button>
            ),
          },
          {
            key: 'categoryNameAr',
            label: copy.category,
            render: (_value: unknown, row: OrderItemsReportRow) => row.categoryId ? (
              <Button
                variant="ghost"
                type="button"
                onClick={() => setHistoryModal({
                  category: {
                    id: row.categoryId || undefined,
                    nameAr: row.categoryNameAr || undefined,
                    nameEn: row.categoryNameEn || undefined,
                  },
                })}
                className="text-[12px] text-noorix-blue underline"
              >
                {row.categoryNameAr || row.categoryNameEn || '—'}
              </Button>
            ) : <span className="nx-cell-muted">—</span>,
          },
          {
            key: 'packaging',
            label: copy.sizePackaging,
            render: (_value: unknown, row: OrderItemsReportRow) => (
              <span className="nx-cell-muted">{[row.size, row.packaging].filter(Boolean).join(' / ') || '—'}</span>
            ),
          },
          { key: 'unit', label: copy.unit, render: (_value: unknown, row: OrderItemsReportRow) => <span className="nx-cell-muted">{row.unit || '—'}</span> },
          { key: 'quantity', label: copy.rawQuantity, numeric: true, render: (_value: unknown, row: OrderItemsReportRow) => fmt(row.quantity) },
          {
            key: 'normalizedQuantity',
            label: copy.baseQuantity,
            numeric: true,
            render: (_value: unknown, row: OrderItemsReportRow) => (
              <span>{fmt(row.normalizedQuantity ?? row.quantity)} {row.baseUnit || row.unit || ''}</span>
            ),
          },
          {
            key: 'amount',
            label: t('total'),
            numeric: true,
            render: (_value: unknown, row: OrderItemsReportRow) => <span className="nx-cell-num--green"><FmtNum n={row.amount} /> SR</span>,
          },
          { key: 'orderCount', label: copy.distinctOrders, numeric: true },
          {
            key: 'averageUnitPrice',
            label: copy.averagePrice,
            numeric: true,
            render: (_value: unknown, row: OrderItemsReportRow) => <><FmtNum n={row.averageUnitPrice ?? 0} /> SR</>,
          },
          {
            key: 'lastOrderDate',
            label: copy.lastPurchase,
            render: (_value: unknown, row: OrderItemsReportRow) => row.lastOrderDate ? formatSaudiDate(row.lastOrderDate) : '—',
          },
        ]}
        data={displayed}
        isLoading={isLoading}
        emptyMessage={copy.noData}
        footerCells={filtered.length > 0 ? (
          <>
            <td colSpan={6} className="px-3 py-2 text-[12px] font-bold text-noorix-muted">{copy.currentFiltersTotal}</td>
            <td className="px-3 py-2 text-right font-bold nx-font-numbers">
              {normalizedTotal ? `${fmt(normalizedTotal[1])} ${normalizedTotal[0]}` : copy.mixedUnits}
            </td>
            <td className="px-3 py-2 text-right font-bold text-noorix-green nx-font-numbers"><FmtNum n={totals.amount} /> SR</td>
            <td className="px-3 py-2 text-right font-bold nx-font-numbers">{totals.distinctOrders}</td>
            <td colSpan={2} />
          </>
        ) : null}
        renderCompactRow={(row: OrderItemsReportRow) => (
          <div className="cursor-pointer" onClick={() => setHistoryModal({ product: { ...row, id: row.productId } })}>
            <div className="nx-cr__line1">
              <span className="nx-cr__name text-noorix-blue">{row.productNameAr || row.productNameEn || '—'}</span>
              <span className="nx-cr__sub">{(row.sectionNames || [row.sectionName]).filter(Boolean).join('، ')}</span>
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">
                <span className="nx-cr__meta">{copy.baseQuantity}: {fmt(row.normalizedQuantity ?? row.quantity)} {row.baseUnit || ''}</span>
                <span className="nx-cr__meta">{copy.distinctOrders}: {row.orderCount}</span>
              </div>
              <div className="nx-cr__line2-end">
                <span className="nx-cr__amount text-noorix-green"><FmtNum n={row.amount} /> <span className="nx-sar">SR</span></span>
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: OrderItemsReportRow) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" type="button" onClick={() => setHistoryModal({ product: { ...row, id: row.productId } })} className="text-[13px] font-bold text-noorix-blue underline">
                {row.productNameAr || row.productNameEn || '—'}
              </Button>
              <span className="text-[13px] font-bold text-noorix-green nx-cell-num"><FmtNum n={row.amount} /> SR</span>
            </div>
            <div className="flex flex-wrap gap-3 text-[12px] text-noorix-muted">
              <span>{(row.sectionNames || [row.sectionName]).filter(Boolean).join('، ') || copy.unassigned}</span>
              {row.categoryNameAr && <span>{row.categoryNameAr}</span>}
              <span>{copy.baseQuantity}: {fmt(row.normalizedQuantity ?? row.quantity)} {row.baseUnit || ''}</span>
              <span>{copy.distinctOrders}: {row.orderCount}</span>
            </div>
          </div>
        )}
      />

      {historyModal && (
        <PurchaseHistoryModal
          companyId={companyId}
          startDate={startDate}
          endDate={endDate}
          product={historyModal.product}
          category={historyModal.category}
          onClose={() => setHistoryModal(null)}
          t={t}
        />
      )}
    </div>
  );
}
