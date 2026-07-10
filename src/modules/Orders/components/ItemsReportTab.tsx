/**
 * ItemsReportTab — تقارير الأصناف والفئات
 * فلاتر، رسوم بيانية، تاريخ الشراء، تصدير
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { useOrdersItemsReportRange, useProductPurchaseHistory, useCategoryPurchaseHistory } from '../../../hooks/useOrders';
import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { DateFilterBar } from '../../../ui/date';
import { exportToExcel } from '../../../utils/exportUtils';
import { buildPrintTableHtml } from '../../../utils/printTableHtml';
import { Button, Input, AdaptiveSheet, SmartTable, SimpleTable, FmtNum, MetricCard, DataBar, FilterToolbar, SearchableOptionsPicker, usePrintPreview } from '../../../ui';
import { computeItemsReportDisplayTotals, sliceItemsReportByMode } from '../utils/ordersReportModel';
import type { OrderItemsReportRow, OrderPurchaseHistoryRow } from '../../../types/api';

const CHART_COLORS = ['var(--noorix-accent-blue)', 'var(--noorix-accent-green)', 'var(--noorix-accent-amber)', 'var(--noorix-accent-red)', 'var(--noorix-accent-violet)', '#0891b2'];

function BarChart({
  data,
  maxVal,
  labelKey,
  valueKey,
  color = 'var(--noorix-accent-blue)',
}: {
  data: OrderItemsReportRow[];
  maxVal: number;
  labelKey: keyof OrderItemsReportRow;
  valueKey: keyof Pick<OrderItemsReportRow, 'amount' | 'quantity' | 'orderCount'>;
  color?: string;
}) {
  const m = maxVal > 0 ? maxVal : 1;
  const getLabel = (r: OrderItemsReportRow) => String(r[labelKey] || r.productNameEn || r.categoryNameEn || '—');
  return (
    <div className="flex flex-col gap-1.5">
      {data.slice(0, 10).map((r, i) => (
        <div key={i} className="flex items-center gap-8">
          <span className="text-[12px] truncate min-w-[80px]" title={getLabel(r)}>
            {getLabel(r)}
          </span>
          <div className="flex-1 min-w-0 bg-noorix-bg-muted overflow-hidden h-5 rounded">
            <DataBar
              className="h-full rounded transition-[width] duration-300"
              widthPercent={(Number(r[valueKey]) / m) * 100}
              color={color}
            />
          </div>
          <span className="text-[12px] min-w-[60px] text-left nx-font-numbers">
            <FmtNum n={r[valueKey]} />
          </span>
        </div>
      ))}
    </div>
  );
}

function PurchaseHistoryModal({
  companyId,
  year,
  month,
  product,
  category,
  onClose,
  t,
}: {
  companyId: string;
  year: number;
  month: number;
  product?: OrderItemsReportRow | null;
  category?: { id?: string; nameAr?: string | null; nameEn?: string | null } | null;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const isProduct = !!product;
  const productId = product?.id ?? product?.productId ?? '';
  const categoryId = category?.id ?? '';

  const { data: productHistory = [], isLoading: productLoading } = useProductPurchaseHistory(
    companyId, productId, year, month, isProduct,
  );
  const { data: categoryHistory = [], isLoading: categoryLoading } = useCategoryPurchaseHistory(
    companyId, categoryId, year, month, !isProduct,
  );

  const history: OrderPurchaseHistoryRow[] = isProduct ? productHistory : categoryHistory;
  const isLoading = isProduct ? productLoading : categoryLoading;
  const title = isProduct ? (product?.productNameAr || product?.nameAr || product?.productNameEn || product?.nameEn || productId) : (category?.nameAr || category?.nameEn || categoryId);

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
        <div className="text-center text-noorix-muted p-10">{t('loading')}</div>
      ) : history.length === 0 ? (
        <div className="text-center text-noorix-muted p-10">{t('ordersNoPurchaseHistory')}</div>
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
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('ordersItemsReportTab'),
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });
  const [filterMode, setFilterMode] = useState('all'); // all | top | bottom
  const [filterCount, setFilterCount] = useState(10);
  const [historyModal, setHistoryModal] = useState<{ product?: OrderItemsReportRow; category?: { id?: string; nameAr?: string | null; nameEn?: string | null } } | null>(null);

  const startDate = propStartDate || `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = propEndDate || `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const { data: report = [], isLoading } = useOrdersItemsReportRange(companyId, startDate, endDate);

  const filtered = useMemo(() => {
    return sliceItemsReportByMode(report, filterMode, filterCount);
  }, [report, filterMode, filterCount]);

  const totals = useMemo(() => computeItemsReportDisplayTotals(filtered), [filtered]);

  const maxAmount = useMemo(() => Math.max(...filtered.map((r) => Number(r.amount ?? 0)), 1), [filtered]);
  const currentFilterLabel = lang === 'ar' ? 'حسب الفلتر الحالي' : 'Current filter';

  const handleExportExcel = async () => {
    try {
      const rows = filtered.map((r) => ({
        [t('product')]: r.productNameAr || r.productNameEn || '—',
        [t('category')]: r.categoryNameAr || r.categoryNameEn || '—',
        [t('unit')]: r.unit || '—',
        [t('quantity')]: fmt(r.quantity ?? 0),
        [t('total')]: fmt(r.amount ?? 0),
        [t('ordersOrderCount')]: r.orderCount ?? 0,
      }));
      await exportToExcel(rows, `orders-items-report-${year}-${month}.xlsx`);
      showToast(t('exportSuccess'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('exportFailed'), 'error');
    }
  };

  const handlePrintPdf = async () => {
    try {
      const cols = [t('product'), t('category'), t('quantity'), t('total'), t('ordersOrderCount')];
      const data = filtered.map((r) => ({
        [t('product')]: r.productNameAr || r.productNameEn || '—',
        [t('category')]: r.categoryNameAr || r.categoryNameEn || '—',
        [t('quantity')]: fmt(r.quantity ?? 0),
        [t('total')]: fmt(r.amount ?? 0),
        [t('ordersOrderCount')]: r.orderCount ?? 0,
      }));
      openPrintDocumentPreview({
        title: `${t('ordersItemsReportTab')} - ${year}/${month}`,
        subtitle: `orders-items-${year}-${month}.pdf`,
        landscape: true,
        body: buildPrintTableHtml({
          columns: cols.map((label, index) => ({ key: String(index), header: label })),
          rows: data.map((row) => cols.reduce<Record<string, unknown>>((acc, label, index) => {
            acc[String(index)] = row[label] ?? '';
            return acc;
          }, {})),
        }),
      });
      showToast(t('exportSuccess'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('exportFailed'), 'error');
    }
  };

  return (
    <div className="nx-orders-tab-root flex flex-col gap-3 sm:gap-4">
      {printPreviewModal}
      <FilterToolbar
        className="nx-page-header nx-page-header--filter-row"
        actions={(
          <>
            <div className="w-full min-w-0 sm:w-[min(100%,12rem)]">
              <SearchableOptionsPicker
                value={filterMode}
                onChange={setFilterMode}
                options={[
                  { value: 'all', label: t('ordersFilterAll') },
                  { value: 'top', label: t('ordersFilterTop') },
                  { value: 'bottom', label: t('ordersFilterBottom') },
                ]}
                aria-label={t('ordersFilterAll')}
              />
            </div>
            {(filterMode === 'top' || filterMode === 'bottom') && (
              <Input
                type="number"
                min={1}
                max={50}
                value={filterCount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterCount(Math.max(1, Math.min(50, Number.parseInt(e.target.value, 10) || 5)))}
                className="w-[80px]"
              />
            )}
            <Button type="button" size="sm" className="noorix-print-hide" onClick={handleExportExcel} disabled={filtered.length === 0}>Excel</Button>
            <Button type="button" size="sm" className="noorix-print-hide" onClick={handlePrintPdf} disabled={filtered.length === 0}>{t('print')} / PDF</Button>
          </>
        )}
      >
        <DateFilterBar filter={dateFilter} />
      </FilterToolbar>

      {/* كروت الإجمالي — MetricCard الموحّد */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard color="var(--color-nx-purchases)">
          <MetricCard.Header label={t('ordersTotalItems')} subLabel={currentFilterLabel} />
          <MetricCard.Value value={filtered.length} />
        </MetricCard>
        <MetricCard color="var(--color-nx-sales)">
          <MetricCard.Header label={t('ordersTotalQuantity')} subLabel={currentFilterLabel} />
          <MetricCard.Value value={fmt(totals.quantity, 0)} color="var(--color-nx-sales)" />
        </MetricCard>
        <MetricCard color="var(--color-nx-profit)">
          <MetricCard.Header label={t('ordersTotalAmount')} subLabel={currentFilterLabel} />
          <MetricCard.Value value={totals.amount} currency="SR" color="var(--color-nx-profit)" />
        </MetricCard>
      </div>

      {/* رسم بياني */}
      {filtered.length > 0 && (
        <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 p-3 sm:bg-noorix-surface sm:p-5">
          <div className="text-[13px] font-bold mb-4 text-noorix-muted">
            {filterMode === 'top' ? t('ordersChartTop') : filterMode === 'bottom' ? t('ordersChartBottom') : t('ordersChartAll')}
          </div>
          <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
            <div>
              <div className="text-[12px] mb-2 text-noorix-muted">{t('ordersChartByAmount')}</div>
              <BarChart data={filtered} maxVal={maxAmount} labelKey="productNameAr" valueKey="amount" color="#2563eb" />
            </div>
            <div>
              <div className="text-[12px] mb-2 text-noorix-muted">{t('ordersChartByOrders')}</div>
              <BarChart data={filtered} maxVal={Math.max(...filtered.map((r) => r.orderCount ?? 0), 1)} labelKey="productNameAr" valueKey="orderCount" color="#16a34a" />
            </div>
          </div>
        </div>
      )}

      {/* جدول */}
      <SmartTable
        columns={[
          {
            key: 'productNameAr',
            label: t('product'),
            render: (_: unknown, r: OrderItemsReportRow) => (
              <Button
                variant="ghost"
                type="button"
                onClick={() => setHistoryModal({ product: { ...r, id: r.productId } })}
                className="text-[13px] font-semibold text-noorix-blue underline"
              >
                {r.productNameAr || r.productNameEn || '—'}
              </Button>
            ),
          },
          {
            key: 'categoryNameAr',
            label: t('category'),
            render: (_: unknown, r: OrderItemsReportRow) => r.categoryId ? (
              <Button
                variant="ghost"
                type="button"
                onClick={() => setHistoryModal({ category: { id: r.categoryId || undefined, nameAr: r.categoryNameAr || undefined, nameEn: r.categoryNameEn || undefined } })}
                className="text-[13px] text-noorix-blue underline"
              >
                {r.categoryNameAr || r.categoryNameEn || '—'}
              </Button>
            ) : <span className="nx-cell-muted">—</span>,
          },
          { key: 'unit', label: t('unit'), render: (_value: unknown, row: OrderItemsReportRow) => <span className="nx-cell-muted">{row.unit || '—'}</span> },
          { key: 'quantity', label: t('quantity'), numeric: true, render: (_value: unknown, row: OrderItemsReportRow) => fmt(row.quantity ?? 0) },
          {
            key: 'amount',
            label: t('total'),
            numeric: true,
            render: (_value: unknown, row: OrderItemsReportRow) => <span className="nx-cell-num--green"><FmtNum n={row.amount ?? 0} /> SR</span>,
          },
          { key: 'orderCount', label: t('ordersOrderCount'), numeric: true, render: (_value: unknown, row: OrderItemsReportRow) => row.orderCount ?? 0 },
        ]}
        data={filtered}
        isLoading={isLoading}
        emptyMessage={t('ordersNoItemsInPeriod')}
        footerCells={filtered.length > 0 ? (
          <>
            <td colSpan={3} className="font-bold text-[12px] text-noorix-muted py-2 px-3">{t('total')}</td>
            <td className="font-bold text-right py-2 px-3 nx-font-numbers">{fmt(totals.quantity)}</td>
            <td className="font-bold text-right text-noorix-green py-2 px-3 nx-font-numbers"><FmtNum n={totals.amount} /> SR</td>
            <td className="py-2 px-3" />
          </>
        ) : null}
        renderCompactRow={(r: OrderItemsReportRow) => (
          <div className="cursor-pointer" onClick={() => setHistoryModal({ product: { ...r, id: r.productId } })}>
            <div className="nx-cr__line1">
              <span className="nx-cr__name text-noorix-blue">{r.productNameAr || r.productNameEn || '—'}</span>
              {r.categoryNameAr && <span className="nx-cr__sub">{r.categoryNameAr}</span>}
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">
                <span className="nx-cr__meta">{t('quantity')}: {fmt(r.quantity ?? 0)}</span>
                {r.unit && <span className="nx-cr__meta">{r.unit}</span>}
                <span className="nx-cr__meta">{t('ordersOrderCount')}: {r.orderCount ?? 0}</span>
              </div>
              <div className="nx-cr__line2-end">
                <span className="nx-cr__amount text-noorix-green"><FmtNum n={r.amount ?? 0} /> <span className="nx-sar">SR</span></span>
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(r: OrderItemsReportRow) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" type="button" onClick={() => setHistoryModal({ product: { ...r, id: r.productId } })} className="font-bold text-noorix-blue underline text-[13px]">
                {r.productNameAr || r.productNameEn || '—'}
              </Button>
              <span className="nx-cell-num text-noorix-green font-bold text-[13px]"><FmtNum n={r.amount ?? 0} /> SR</span>
            </div>
            <div className="flex gap-3 text-[12px] text-noorix-muted">
              {r.categoryNameAr && <span>{r.categoryNameAr}</span>}
              {r.unit && <span>{r.unit}</span>}
              <span>{t('quantity')}: {fmt(r.quantity ?? 0)}</span>
              <span>{t('ordersOrderCount')}: {r.orderCount ?? 0}</span>
            </div>
          </div>
        )}
      />

      {historyModal && (
        <PurchaseHistoryModal
          companyId={companyId}
          year={year}
          month={month}
          product={historyModal.product}
          category={historyModal.category}
          onClose={() => setHistoryModal(null)}
          t={t}
        />
      )}
    </div>
  );
}
