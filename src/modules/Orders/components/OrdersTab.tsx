/**
 * OrdersTab — تبويبة الطلبات
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import {
  useOrdersRange,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useCancelOrderMutation,
  useOrderProducts,
} from '../../../hooks/useOrders';
import { getDailySalesSummaries } from '../../../services/api';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { exportToExcel } from '../../../utils/exportUtils';
import { openPrintWindow } from '../../../utils/printUtils';
import { salesKeys } from '../../../services/queryKeys';
import {
  buildOrderPrintHtml,
  buildSingleOrderExportRows,
  buildWhatsAppText,
  computeCashSalesTotal,
  computeCumulativeRemainingByOrderId,
  computeOrdersSummaryForRange,
  computeOrdersTotal,
  filterOrdersByDate,
  filterOrdersByType,
  mergeOrderCatalogProducts,
  resolveOrdersDateRange,
} from '../utils/ordersTabModel';
import DateFilterBar from '../../../shared/components/DateFilterBar';
import FilterToolbar from '../../../shared/components/FilterToolbar';
import { OrderFormModal } from './OrderFormModal';
import { OrdersSummaryCard } from './OrdersSummaryCard';
import { Button, Badge, AdaptiveSheet, SmartTable, KebabMenu, FmtNum } from '../../../ui';

export function OrdersTab({
  companyId,
  year,
  month,
  startDate: propStartDate,
  endDate: propEndDate,
  dateFilter,
}: {
  companyId: any;
  year: any;
  month: any;
  startDate?: string;
  endDate?: string;
  dateFilter: any;
}) {
  const { t } = useTranslation();
  const { companies = [] } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const { showToast } = useToast();
  const [orderTypeFilter, setOrderTypeFilter] = useState('all'); // 'all' | 'external' | 'internal'
  const [viewingOrder, setViewingOrder] = useState<any>(null);

  const { startDate, endDate } = useMemo(
    () => resolveOrdersDateRange({ year, month, propStartDate, propEndDate }),
    [propStartDate, propEndDate, year, month],
  );

  const { data: orders = [], isLoading, error: ordersError } = useOrdersRange(companyId, startDate, endDate);
  const { data: orderCatalog = [] } = useOrderProducts(companyId, 'order');
  /** طلبات المشتريات — أصناف «طلبات» فقط؛ عند التعديل نُبقي أصناف السطر الحالية حتى لو كانت مبيعات قديماً */
  const products = useMemo(() => mergeOrderCatalogProducts(orderCatalog, editingOrder), [orderCatalog, editingOrder]);
  const createOrder = useCreateOrderMutation(companyId);
  const updateOrder = useUpdateOrderMutation(companyId);
  const cancelOrder = useCancelOrderMutation(companyId);

  const { data: salesData } = useApiQuery<any>({
    queryKey: salesKeys.summaries(companyId, startDate, endDate),
    queryFn: () => getDailySalesSummaries(companyId, startDate, endDate, 1, 200),
    fallbackMessage: t('loadingError'),
    enabled: !!companyId && !!year && !!month,
  });

  /** نقد المحل: مبيعات قناة النقد فقط (خزائن type=cash)، لا إجمالي كل القنوات */
  const cashSalesTotal = useMemo(() => computeCashSalesTotal(salesData), [salesData]);

  const dateFilteredOrders = useMemo(() => filterOrdersByDate(orders, startDate, endDate), [orders, startDate, endDate]);

  const filteredOrders = useMemo(
    () => filterOrdersByType(dateFilteredOrders, orderTypeFilter),
    [dateFilteredOrders, orderTypeFilter],
  );

  const filteredTotal = useMemo(() => computeOrdersTotal(filteredOrders), [filteredOrders]);

  const summary = useMemo(
    () =>
      computeOrdersSummaryForRange({
        summaryFromApi: null,
        dateFilteredOrders,
        startDate,
        endDate,
        year,
        month,
      }),
    [dateFilteredOrders, startDate, endDate, year, month],
  );

  const cumulativeRemainingByOrderId = useMemo(
    () => computeCumulativeRemainingByOrderId(dateFilteredOrders),
    [dateFilteredOrders],
  );

  const ordersColumns = useMemo(
    () => [
      {
        key: 'orderNumber',
        label: t('orderNumber'),
        minWidth: 100,
        align: 'center',
        shrink: true,
        render: (v: any) => <span className="nx-cell-num nx-cell-num--blue whitespace-nowrap">{v}</span>,
      },
      {
        key: 'orderDate',
        label: t('orderDate'),
        minWidth: 115,
        align: 'center',
        render: (v: any) => <span className="whitespace-nowrap">{formatSaudiDate(v)}</span>,
      },
      {
        key: 'orderType',
        label: t('orderType'),
        align: 'center',
        shrink: true,
        render: (v: any) => {
          const isExt = v === 'external';
          return (
            <Badge color={isExt ? 'blue' : 'green'} size="sm">
              {isExt ? t('orderTypeExternal') : t('orderTypeInternal')}
            </Badge>
          );
        },
      },
      {
        key: 'items',
        label: t('ordersTotalItems'),
        numeric: true,
        align: 'center',
        shrink: true,
        render: (items: any) => (items ?? []).length,
      },
      {
        key: 'pettyCashAmount',
        label: t('ordersPettyCashGiven'),
        align: 'center',
        shrink: true,
        render: (v: any, o: any) =>
          o.orderType === 'external' && v != null ? (
            <span className="nx-cell-num nx-cell-num--blue whitespace-nowrap"><FmtNum n={Number(v)} /> SR</span>
          ) : (
            <span className="nx-cell-muted">—</span>
          ),
      },
      {
        key: 'totalAmount',
        label: t('orderTotalAmount') || t('ordersDelegatePurchases'),
        numeric: true,
        align: 'center',
        shrink: true,
        render: (v: any) => <span className="nx-cell-num font-bold whitespace-nowrap"><FmtNum n={Number(v ?? 0)} /> SR</span>,
      },
      {
        key: 'id',
        label: t('ordersCumulativeRemaining'),
        align: 'center',
        shrink: true,
        render: (_: any, o: any) => {
          const cumRem = o.orderType === 'external' ? cumulativeRemainingByOrderId.get(o.id) : null;
          if (cumRem == null) return <span className="nx-cell-muted">—</span>;
          return (
            <Badge color={cumRem >= 0 ? 'green' : 'red'} size="sm">
              {cumRem >= 0 ? '' : '−'}
              <FmtNum n={Math.abs(cumRem)} /> SR
            </Badge>
          );
        },
      },
      {
        key: 'actions',
        label: t('actions'),
        align: 'center',
        width: '1%',
        shrink: true,
        render: (_: any, o: any) => (
          <KebabMenu
            ariaLabel={t('actions')}
            menuMaxHeight={320}
            items={[
              { key: 'view', label: t('view'), style: { color: 'var(--noorix-text)' }, onClick: () => handleView(o) },
              { key: 'wa', label: t('sendWhatsApp'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => handleWhatsApp(o) },
              { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => handleEdit(o) },
              { key: 'del', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => handleDelete(o) },
            ]}
          />
        ),
      },
    ],
    [t, fmt, formatSaudiDate, cumulativeRemainingByOrderId],
  );

  const ordersFooterCells = useMemo(
    () => (
      <>
        <td colSpan={5} className="font-bold text-center py-[11px] px-[14px]">
          {t('ordersFilteredTotal')}
        </td>
        <td className="nx-cell-num nx-cell-num--blue font-extrabold text-center text-[14px] py-[11px] px-[14px]">
          <FmtNum n={filteredTotal} /> SR
        </td>
        <td className="text-center py-[11px] px-[14px]" />
        <td className="noorix-print-hide py-[11px] px-[14px]" />
      </>
    ),
    [t, filteredTotal, fmt],
  );

  const ordersRenderMobileCard = useCallback(
    (o: any) => {
      const pettyGiven = o.orderType === 'external' ? Number(o.pettyCashAmount ?? 0) : null;
      const cumRem = o.orderType === 'external' ? cumulativeRemainingByOrderId.get(o.id) : null;
      const isExt = o.orderType === 'external';
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-noorix-blue nx-font-numbers">#{o.orderNumber}</span>
            <Badge color={isExt ? 'blue' : 'green'} size="sm">
              {isExt ? t('orderTypeExternal') : t('orderTypeInternal')}
            </Badge>
          </div>
          <div className="text-[12px] text-noorix-muted text-end">{formatSaudiDate(o.orderDate)}</div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-noorix-bg-muted py-2 px-2.5">
            <div className="flex min-w-0 flex-col items-center">
              <div className="text-[10px] text-noorix-muted mb-0.5 w-full text-center">{t('ordersTotalItems')}</div>
              <div className="text-[13px] font-semibold nx-font-numbers w-full text-center">{(o.items ?? []).length}</div>
            </div>
            <div className="flex min-w-0 flex-col items-center">
              <div className="text-[10px] text-noorix-muted mb-0.5 w-full text-center">{t('orderTotalAmount')}</div>
              <div dir="ltr" className="text-[13px] font-bold nx-font-numbers text-noorix-navy w-full text-center"><FmtNum n={Number(o.totalAmount ?? 0)} /> SR</div>
            </div>
            {pettyGiven != null && (
              <div className="flex min-w-0 flex-col items-center">
                <div className="text-[10px] text-noorix-muted mb-0.5 w-full text-center">{t('ordersPettyCashGiven')}</div>
                <div dir="ltr" className="text-[13px] nx-font-numbers text-noorix-blue w-full text-center"><FmtNum n={pettyGiven} /> SR</div>
              </div>
            )}
            {cumRem != null && (
              <div className="flex min-w-0 flex-col items-center">
                <div className="text-[10px] text-noorix-muted mb-0.5 w-full text-center">{t('ordersCumulativeRemaining')}</div>
                <div className="flex w-full justify-center">
                  <Badge color={cumRem >= 0 ? 'green' : 'red'} size="sm">
                    {cumRem >= 0 ? '' : '−'}
                    <FmtNum n={Math.abs(cumRem)} /> SR
                  </Badge>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <KebabMenu
              ariaLabel={t('actions')}
              menuMaxHeight={320}
              items={[
                { key: 'view', label: t('view'), style: { color: 'var(--noorix-text)' }, onClick: () => handleView(o) },
                { key: 'wa', label: t('sendWhatsApp'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => handleWhatsApp(o) },
                { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => handleEdit(o) },
                { key: 'del', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => handleDelete(o) },
              ]}
            />
          </div>
        </div>
      );
    },
    [t, fmt, formatSaudiDate, cumulativeRemainingByOrderId],
  );

  const renderCompactRow = useCallback(
    (o: any) => {
      const isExt = o.orderType === 'external';
      const total = Number(o.totalAmount ?? 0);
      const cumRem = cumulativeRemainingByOrderId?.get(o.id);
      return (
        <div onClick={() => handleView(o)} style={{ cursor: 'pointer' }}>
          <div className="nx-cr__line1">
            <span className="nx-cr__id">#{o.orderNumber}</span>
            <Badge color={isExt ? 'blue' : 'green'} size="sm">
              {isExt ? t('orderTypeExternal') : t('orderTypeInternal')}
            </Badge>
            {cumRem != null && (
              <Badge color={cumRem >= 0 ? 'green' : 'red'} size="sm">
                {cumRem >= 0 ? '' : '−'}<FmtNum n={Math.abs(cumRem)} />
              </Badge>
            )}
          </div>
          <div className="nx-cr__line2">
            <div className="nx-cr__line2-start">
              <span className="nx-cr__meta">{formatSaudiDate(o.orderDate)}</span>
              <span className="nx-cr__meta">{(o.items ?? []).length} {t('ordersTotalItems')}</span>
            </div>
            <div className="nx-cr__line2-end">
              <span className="nx-cr__amount"><FmtNum n={total} /> <span className="nx-sar">SR</span></span>
              <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
                <KebabMenu
                  ariaLabel={t('actions')}
                  items={[
                    { key: 'view', label: t('view'), onClick: () => handleView(o) },
                    { key: 'wa', label: t('sendWhatsApp'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => handleWhatsApp(o) },
                    { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => handleEdit(o) },
                    { key: 'del', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => handleDelete(o) },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      );
    },
    [t, formatSaudiDate, cumulativeRemainingByOrderId],
  );

  function handleWhatsApp(order: any) {
    const text = encodeURIComponent(buildWhatsAppText(order, t));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function handleEdit(order: any) {
    setEditingOrder(order);
    setShowModal(true);
  }

  function handleDelete(order: any) {
    if (!window.confirm(t('ordersDeleteConfirm', order.orderNumber))) return;
    cancelOrder.mutate(order.id, {
      onSuccess: () => showToast(t('ordersOrderCancelled'), 'success'),
      onError: (e: any) => showToast(e?.message || t('deleteFailed'), 'error'),
    });
  }

  function handleView(order: any) {
    setViewingOrder(order);
  }

  const handleExportSingleOrder = async (order: any) => {
    try {
      const rows = buildSingleOrderExportRows(order, t);
      await exportToExcel(rows, `order-${order.orderNumber}.xlsx`);
      showToast(t('exportSuccess'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('exportFailed'), 'error');
    }
  };

  const handlePrintOrder = (order: any) => {
    const bodyHtml = buildOrderPrintHtml(order, t);
    openPrintWindow({
      title: `${t('ordersPrintOrder')} — ${order.orderNumber}`,
      companyName,
      subtitle: `${t('ordersViewOrder')} — ${order.orderNumber}`,
      body: bodyHtml,
    });
  };

  function closeModal() {
    setShowModal(false);
    setEditingOrder(null);
  }

  const companyName = companies.find((c: any) => c.id === companyId)?.nameAr || companies.find((c: any) => c.id === companyId)?.nameEn || '';
  const printDate = `${year}/${String(month).padStart(2, '0')}`;

  return (
    <div className="nx-orders-tab-root flex min-w-0 flex-col gap-3 sm:gap-4">
      <div className="noorix-print-header hidden print:block">
        {companyName} — {t('ordersTab')} — {printDate}
      </div>

      <FilterToolbar
        className="nx-orders-filter-row nx-page-header nx-page-header--filter-row"
        actions={(
          <Button
            variant="primary"
            size="sm"
            className="noorix-print-hide w-full min-h-11 sm:w-auto sm:min-h-0"
            onClick={() => { setEditingOrder(null); setShowModal(true); }}
          >
            + {t('ordersNewOrder')}
          </Button>
        )}
      >
        <DateFilterBar filter={dateFilter} />
      </FilterToolbar>

      <OrdersSummaryCard summary={summary} cashSalesTotal={cashSalesTotal} isLoading={isLoading} />

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
            <div className="nx-toolbar flex-wrap">
              {['all', 'external', 'internal'].map((v: any) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={orderTypeFilter === v ? 'primary' : 'ghost'}
                  onClick={() => setOrderTypeFilter(v)}
                >
                  {v === 'all' ? t('ordersFilterAll') : v === 'external' ? t('orderTypeExternal') : t('orderTypeInternal')}
                </Button>
              ))}
            </div>
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
          onError={(msg: any) => showToast(msg || t('saveFailed'), 'error')}
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
            <>
              <Button variant="primary" size="sm" onClick={() => handlePrintOrder(viewingOrder)}>
                {t('ordersPrintOrder')}
              </Button>
              <Button size="sm" onClick={() => handleExportSingleOrder(viewingOrder)}>
                {t('exportExcel')}
              </Button>
            </>
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
                {viewingOrder.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal')}
              </div>
            </div>
            {viewingOrder.orderType === 'external' && viewingOrder.pettyCashAmount != null && (
              <div>
                <div className="text-[11px] text-noorix-muted mb-1 uppercase tracking-[0.05em]">{t('ordersPettyCashGiven')}</div>
                <div className="nx-cell-num nx-cell-num--blue text-[15px] font-semibold"><FmtNum n={viewingOrder.pettyCashAmount ?? 0} /> SR</div>
              </div>
            )}
          </div>

          <div className="text-[16px] font-bold mb-3">{t('orderItems')}</div>
          <SmartTable
            columns={[
              { key: '_idx', label: '#', shrink: true, render: (_: any, _row: any, i: any) => <span className="nx-cell-muted">{i + 1}</span> },
              {
                key: 'product',
                label: t('product'),
                render: (_: any, it: any) => (
                  <>
                    {it.product?.nameAr || it.product?.nameEn || '—'}
                    {[it.size, it.packaging, it.unit].filter(Boolean).length > 0 && (
                      <span className="nx-cell-muted text-[12px]"> ({[it.size, it.packaging, it.unit].filter(Boolean).join(' / ')})</span>
                    )}
                  </>
                ),
              },
              { key: 'quantity', label: t('quantity'), numeric: true, align: 'center' },
              { key: 'unitPrice', label: t('unitPrice'), numeric: true, render: (v: any) => `${fmt(v ?? 0)} SR` },
              { key: 'amount',    label: t('total'),    numeric: true, render: (v: any) => <span className="font-semibold"><FmtNum n={v ?? 0} /> SR</span> },
            ]}
            data={viewingOrder.items ?? []}
            tableMinWidth={480}
            showRowNumbers={false}
            footerCells={
              <>
                <td colSpan={4} className="font-bold text-end" style={{ padding: '10px 16px' }}>{t('total')}</td>
                <td className="nx-cell-num font-bold text-[15px]" style={{ padding: '10px 16px', textAlign: 'right' }}><FmtNum n={viewingOrder.totalAmount ?? 0} /> SR</td>
              </>
            }
          />
        </AdaptiveSheet>
      )}
    </div>
  );
}
