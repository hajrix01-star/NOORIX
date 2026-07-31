/**
 * OrdersTab — تبويبة الطلبات
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import {
  useOrdersRange,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useCancelOrderMutation,
  useOrderProducts,
  useOrdersRangeSummary,
} from '../../../hooks/useOrders';
import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { exportToExcel } from '../../../utils/exportUtils';
import {
  buildOrderPrintHtml,
  buildSingleOrderExportRows,
  buildWhatsAppText,
  computeCumulativeRemainingByOrderId,
  computeOrdersTotal,
  filterOrdersByDate,
  filterOrdersByType,
  isPettyCashOrderType,
  mergeOrderCatalogProducts,
  orderTypeLabel,
  resolveOrdersDateRange,
} from '../utils/ordersTabModel';
import { DateFilterBar } from '../../../ui/date';
import { OrderFormModal } from './OrderFormModal';
import { OrdersSummaryCard } from './OrdersSummaryCard';
import { OrderConfirmModal } from './OrderConfirmModal';
import { Button, AdaptiveSheet, DialogActions, FilterToolbar, SmartTable, FmtNum, usePrintPreview } from '../../../ui';
import type { OrderLine, OrderProduct, OrderRecord } from '../../../types/api';
import {
  buildOrdersColumns,
  buildOrdersFooterCells,
  renderOrdersCompactRow,
  renderOrdersMobileCard,
} from './OrdersTableParts';

export function OrdersTab({
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
  const { t } = useTranslation();
  const { companies = [] } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const { showToast } = useToast();
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
  const [viewingOrder, setViewingOrder] = useState<OrderRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderRecord | null>(null);

  const { startDate, endDate } = useMemo(
    () => resolveOrdersDateRange({ year, month, propStartDate, propEndDate }),
    [propStartDate, propEndDate, year, month],
  );

  const { data: orders = [], isLoading, error: ordersError } = useOrdersRange(companyId, startDate, endDate);
  const { data: orderCatalog = [] } = useOrderProducts(companyId, 'order');
  /** طلبات المشتريات — أصناف «طلبات» فقط؛ عند التعديل نُبقي أصناف السطر الحالية حتى لو كانت مبيعات قديماً */
  const products = useMemo<OrderProduct[]>(() => mergeOrderCatalogProducts(orderCatalog, editingOrder), [orderCatalog, editingOrder]);
  const createOrder = useCreateOrderMutation(companyId);
  const updateOrder = useUpdateOrderMutation(companyId);
  const cancelOrder = useCancelOrderMutation(companyId);
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    error: summaryLoadError,
    refetch: refetchSummary,
  } = useOrdersRangeSummary(companyId, startDate, endDate);

  const dateFilteredOrders = useMemo(() => filterOrdersByDate(orders, startDate, endDate), [orders, startDate, endDate]);

  const filteredOrders = useMemo(
    () => filterOrdersByType(dateFilteredOrders, orderTypeFilter),
    [dateFilteredOrders, orderTypeFilter],
  );

  const filteredTotal = useMemo(() => computeOrdersTotal(filteredOrders), [filteredOrders]);
  const cumulativeRemainingByOrderId = useMemo(
    () => computeCumulativeRemainingByOrderId(dateFilteredOrders),
    [dateFilteredOrders],
  );

  const tablePartsInput = useMemo(
    () => ({ t, cumulativeRemainingByOrderId, onView: handleView }),
    [t, cumulativeRemainingByOrderId],
  );
  const ordersColumns = useMemo(
    () => buildOrdersColumns(tablePartsInput),
    [tablePartsInput],
  );
  const ordersFooterCells = useMemo(
    () => buildOrdersFooterCells(t, filteredTotal),
    [t, filteredTotal],
  );
  const ordersRenderMobileCard = useMemo(
    () => (order: OrderRecord) => renderOrdersMobileCard(order, tablePartsInput),
    [tablePartsInput],
  );
  const renderCompactRow = useMemo(
    () => (order: OrderRecord) => renderOrdersCompactRow(order, tablePartsInput),
    [tablePartsInput],
  );

  function handleWhatsApp(order: OrderRecord) {
    const text = encodeURIComponent(buildWhatsAppText(order, t));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function handleEdit(order: OrderRecord) {
    setEditingOrder(order);
    setShowModal(true);
  }

  function handleDelete(order: OrderRecord) {
    setDeleteTarget(order);
  }

  function confirmDeleteOrder() {
    if (!deleteTarget) return;
    cancelOrder.mutate(deleteTarget.id, {
      onSuccess: () => showToast(t('ordersOrderCancelled'), 'success'),
      onError: (e: Error) => showToast(e?.message || t('deleteFailed'), 'error'),
      onSettled: () => setDeleteTarget(null),
    });
  }

  function handleView(order: OrderRecord) {
    setViewingOrder(order);
  }

  const company = companies.find((c) => c.id === companyId);
  const companyName = company?.nameAr || company?.nameEn || '';
  const companyLogoUrl = String(company?.logoUrl || '').trim();
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('ordersPrintOrder'),
    closeLabel: t('close') || 'إغلاق',
    printLabel: `${t('print')} / PDF`,
  });

  const handleExportSingleOrder = async (order: OrderRecord) => {
    try {
      const rows = buildSingleOrderExportRows(order, t);
      await exportToExcel(rows, `order-${order.orderNumber}.xlsx`);
      showToast(t('exportSuccess'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('exportFailed'), 'error');
    }
  };

  const handlePrintOrder = (order: OrderRecord) => {
    const bodyHtml = buildOrderPrintHtml(order, t);
    openPrintDocumentPreview({
      title: `${t('ordersPrintOrder')} — ${order.orderNumber}`,
      companyName,
      logoUrl: companyLogoUrl,
      subtitle: `${t('ordersViewOrder')} — ${order.orderNumber}`,
      body: bodyHtml,
    });
  };

  function closeModal() {
    setShowModal(false);
    setEditingOrder(null);
  }

  const printDate = `${year}/${String(month).padStart(2, '0')}`;

  return (
    <div className="nx-orders-tab-root flex min-w-0 flex-col gap-3 sm:gap-4">
      {printPreviewModal}
      <OrderConfirmModal
        open={!!deleteTarget}
        title={t('confirmDelete')}
        message={deleteTarget ? t('ordersDeleteConfirm', deleteTarget.orderNumber) : ''}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        busy={cancelOrder.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteOrder}
      />
      <div className="noorix-print-header hidden print:block">
        {companyName} — {t('ordersTab')} — {printDate}
      </div>

      <FilterToolbar
        className="nx-orders-filter-row nx-page-header nx-page-header--filter-row"
        actions={(
          <>
          <Button
            variant="primary"
            size="sm"
            className="noorix-print-hide w-full min-h-11 sm:w-auto sm:min-h-0"
            onClick={() => { setEditingOrder(null); setShowModal(true); }}
          >
            + {t('ordersNewOrder')}
          </Button>
          </>
        )}
      >
        <DateFilterBar filter={dateFilter} />
      </FilterToolbar>

      <OrdersSummaryCard
        summary={summary}
        cashSalesTotal={summary?.cashSalesTotal}
        isLoading={summaryLoading}
        errorMessage={summaryError ? summaryLoadError?.message || t('loadingError') : undefined}
        onRetry={() => void refetchSummary()}
      />

      <SmartTable
        compact={false}
        tableLayout="auto"
        stickyActionColumn={false}
        tableMinWidth={960}
        innerPadding={0}
        isLoading={isLoading}
        isError={!!ordersError}
        errorMessage={ordersError?.message || t('loadingError')}
        emptyMessage={
          orders.length === 0
            ? t('ordersNoOrdersInPeriod')
            : dateFilteredOrders.length === 0
              ? t('ordersNoOrdersInRange')
              : t('noDataInPeriod')
        }
        columns={ordersColumns}
        data={filteredOrders}
        total={filteredOrders.length}
        page={1}
        pageSize={Math.max(filteredOrders.length, 1)}
        footerCells={ordersFooterCells}
        renderCompactRow={renderCompactRow}
        renderMobileCard={ordersRenderMobileCard}
        stripeMobileCards
        badge={
          <div className="noorix-print-hide flex flex-wrap items-center gap-2 w-full min-w-0">
            <span className="text-[13px] font-semibold text-noorix-muted shrink-0">{t('ordersFilterByType')}:</span>
            <FilterToolbar variant="bare" className="nx-toolbar flex-wrap">
              {['all', 'external', 'internal', 'transfer'].map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={orderTypeFilter === v ? 'primary' : 'ghost'}
                  onClick={() => setOrderTypeFilter(v)}
                >
                  {v === 'all' ? t('ordersFilterAll') : orderTypeLabel(v, t)}
                </Button>
              ))}
            </FilterToolbar>
            <span className="text-[14px] font-bold nx-font-numbers ms-auto shrink-0">
              {t('ordersFilteredTotal')}: <FmtNum n={filteredTotal} /> SR
            </span>
          </div>
        }
      />

      {showModal && (
        <OrderFormModal
          companyId={companyId}
          products={products}
          initialOrder={editingOrder}
          createOrder={createOrder}
          updateOrder={updateOrder}
          onSuccess={() => showToast(editingOrder ? t('ordersOrderUpdated') : t('orderSaved'), 'success')}
          onError={(msg: string) => showToast(msg || t('saveFailed'), 'error')}
          onClose={closeModal}
          onWhatsApp={handleWhatsApp}
        />
      )}

      {viewingOrder && (
        <AdaptiveSheet
          open={!!viewingOrder}
          onClose={() => setViewingOrder(null)}
          title={`${t('ordersViewOrder')} — ${viewingOrder.orderNumber}`}
          size="xl"
          side="start"
          className="orders-view-drawer"
          footer={
            <DialogActions
              size="sm"
              actions={[
                { key: 'print', label: t('ordersPrintOrder'), role: 'print', onClick: () => handlePrintOrder(viewingOrder) },
                { key: 'excel', label: t('exportExcel'), role: 'secondary', onClick: () => handleExportSingleOrder(viewingOrder) },
                { key: 'whatsapp', label: t('sendWhatsApp'), role: 'success', onClick: () => handleWhatsApp(viewingOrder) },
                {
                  key: 'edit',
                  label: t('edit'),
                  role: 'edit',
                  onClick: () => {
                    const order = viewingOrder;
                    setViewingOrder(null);
                    handleEdit(order);
                  },
                },
                {
                  key: 'delete',
                  label: t('delete'),
                  role: 'delete',
                  onClick: () => {
                    const order = viewingOrder;
                    setViewingOrder(null);
                    handleDelete(order);
                  },
                },
              ]}
            />
          }
        >
          <div className="text-[12px] text-noorix-muted mb-4">{companyName}</div>

          <div className="grid gap-4 p-4 bg-noorix-bg-muted border border-noorix-border mb-6 rounded-[10px] grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
            <div>
              <div className="text-[11px] text-noorix-muted mb-1 uppercase tracking-[0.05em]">{t('orderDate')}</div>
              <div className="text-[15px] font-semibold nx-font-numbers">{formatSaudiDate(viewingOrder.orderDate)}</div>
            </div>
            <div>
              <div className="text-[11px] text-noorix-muted mb-1 uppercase tracking-[0.05em]">{t('orderType')}</div>
              <div className="text-[15px] font-semibold">
                {orderTypeLabel(viewingOrder.orderType, t)}
              </div>
            </div>
            {isPettyCashOrderType(viewingOrder.orderType) && viewingOrder.pettyCashAmount != null && (
              <div>
                <div className="text-[11px] text-noorix-muted mb-1 uppercase tracking-[0.05em]">{t('ordersPettyCashGiven')}</div>
                <div className="nx-cell-num nx-cell-num--blue text-[15px] font-semibold"><FmtNum n={viewingOrder.pettyCashAmount ?? 0} /> SR</div>
              </div>
            )}
          </div>

          <div className="text-[16px] font-bold mb-3">{t('orderItems')}</div>
          <SmartTable
            columns={[
              { key: '_idx', label: '#', shrink: true, render: (_: unknown, _row: OrderLine, i: number) => <span className="nx-cell-muted">{i + 1}</span> },
              {
                key: 'product',
                label: t('product'),
                render: (_: unknown, it: OrderLine) => (
                  <>
                    {it.product?.nameAr || it.product?.nameEn || '—'}
                    {[it.size, it.packaging, it.unit].filter(Boolean).length > 0 && (
                      <span className="nx-cell-muted text-[12px]"> ({[it.size, it.packaging, it.unit].filter(Boolean).join(' / ')})</span>
                    )}
                  </>
                ),
              },
              { key: 'quantity', label: t('quantity'), numeric: true, align: 'center' },
              { key: 'unitPrice', label: t('unitPrice'), numeric: true, render: (_value: unknown, row: OrderLine) => `${fmt(row.unitPrice ?? 0)} SR` },
              { key: 'amount',    label: t('total'),    numeric: true, render: (_value: unknown, row: OrderLine) => <span className="font-semibold"><FmtNum n={row.amount ?? 0} /> SR</span> },
            ]}
            data={viewingOrder.items ?? []}
            tableMinWidth={480}
            showRowNumbers={false}
            footerCells={
              <>
                <td colSpan={4} className="font-bold text-end py-2.5 px-4">{t('total')}</td>
                <td className="nx-cell-num font-bold text-[15px] py-2.5 px-4 text-right"><FmtNum n={viewingOrder.totalAmount ?? 0} /> SR</td>
              </>
            }
          />
        </AdaptiveSheet>
      )}
    </div>
  );
}
