/**
 * OrdersTab — تبويبة الطلبات
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import {
  useOrders,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useCancelOrderMutation,
  useOrdersSummary,
  useOrderProducts,
} from '../../../hooks/useOrders';
import { getDailySalesSummaries } from '../../../services/api';
import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { exportToExcel } from '../../../utils/exportUtils';
import { openPrintWindow } from '../../../utils/printUtils';
import DateFilterBar from '../../../shared/components/DateFilterBar';
import { OrderFormModal } from './OrderFormModal';
import { OrdersSummaryCard } from './OrdersSummaryCard';
import { Button, Badge, AdaptiveSheet, SmartTable, KebabMenu, FmtNum } from '../../../ui';

function buildWhatsAppText(order, t) {
  const lines = (order.items || []).map((it) => {
    const name = it.product?.nameAr || it.product?.nameEn || '—';
    const parts = [it.size, it.packaging, it.unit].filter(Boolean);
    const variantPart = parts.length > 0 ? ` (${parts.join(' / ')})` : '';
    return `${name}${variantPart}: ${it.quantity} × ${fmt(it.unitPrice ?? 0)} = ${fmt(it.amount ?? 0)} SR`;
  }).join('\n');
  const total = fmt(order.totalAmount ?? 0);
  return `طلب ${order.orderNumber}\nالتاريخ: ${formatSaudiDate(order.orderDate)}\nالنوع: ${order.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal')}\n\n${lines}\n\nالإجمالي: ${total} SR`;
}

function buildOrderPrintHtml(order, companyName, t, fmt, formatSaudiDate) {
  const items = order.items ?? [];
  const rows = items.map((it) => {
    const parts = [it.size, it.packaging, it.unit].filter(Boolean);
    const name = (it.product?.nameAr || it.product?.nameEn || '—') + (parts.length > 0 ? ` (${parts.join(' / ')})` : '');
    return `<tr><td>${name}</td><td style="text-align:center">${it.quantity}</td><td>${fmt(it.unitPrice ?? 0)} SR</td><td><strong>${fmt(it.amount ?? 0)} SR</strong></td></tr>`;
  }).join('');
  const orderType = order.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal');
  const pettyRow = order.orderType === 'external' && order.pettyCashAmount != null
    ? `<p style="margin:6px 0"><strong>${t('ordersPettyCashGiven')}:</strong> ${fmt(order.pettyCashAmount ?? 0)} SR</p>`
    : '';
  const meta = `<div style="margin-bottom:16px;font-size:13px">
    <p style="margin:4px 0"><strong>${t('orderDate')}:</strong> ${formatSaudiDate(order.orderDate)}</p>
    <p style="margin:4px 0"><strong>${t('orderType')}:</strong> ${orderType}</p>
    ${pettyRow}
  </div>`;
  const tableHtml = `${meta}<table>
<thead><tr><th>${t('product')}</th><th style="text-align:center">${t('quantity')}</th><th>${t('unitPrice')}</th><th>${t('total')}</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="3">${t('total')}</td><td>${fmt(order.totalAmount ?? 0)} SR</td></tr></tfoot>
</table>`;
  return tableHtml;
}

export function OrdersTab({ companyId, year, month, startDate: propStartDate, endDate: propEndDate, dateFilter }) {
  const { t } = useTranslation();
  const { companies = [] } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const { showToast } = useToast();
  const [orderTypeFilter, setOrderTypeFilter] = useState('all'); // 'all' | 'external' | 'internal'
  const [viewingOrder, setViewingOrder] = useState(null);

  const { data: orders = [], isLoading, error: ordersError } = useOrders(companyId, year, month);
  const { data: products = [] } = useOrderProducts(companyId);
  const { data: summaryFromApi = {}, isLoading: summaryLoading } = useOrdersSummary(companyId, year, month);
  const createOrder = useCreateOrderMutation();
  const updateOrder = useUpdateOrderMutation(companyId);
  const cancelOrder = useCancelOrderMutation(companyId);

  const startDate = useMemo(() => propStartDate || `${year}-${String(month).padStart(2, '0')}-01`, [propStartDate, year, month]);
  const endDate = useMemo(() => {
    if (propEndDate) return propEndDate;
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }, [propEndDate, year, month]);

  const { data: salesData } = useQuery({
    queryKey: ['sales-summaries', companyId, startDate, endDate],
    queryFn: async () => {
      const res = await getDailySalesSummaries(companyId, startDate, endDate);
      if (!res?.success) return { items: [] };
      const items = res.data?.items ?? (Array.isArray(res.data) ? res.data : []);
      return { items: Array.isArray(items) ? items : [] };
    },
    enabled: !!companyId && !!year && !!month,
  });

  const cashSalesTotal = useMemo(() => {
    const items = salesData?.items ?? [];
    return items.reduce((s, v) => s + Number(v.totalAmount ?? 0), 0);
  }, [salesData]);

  const dateFilteredOrders = useMemo(() => {
    const sd = (startDate || '').split('T')[0] || startDate;
    const ed = (endDate || '').split('T')[0] || endDate;
    if (!sd || !ed) return orders;
    return orders.filter((o) => {
      const od = (o.orderDate || '').split('T')[0] || o.orderDate || '';
      return od >= sd && od <= ed;
    });
  }, [orders, startDate, endDate]);

  const filteredOrders = useMemo(() => {
    if (orderTypeFilter === 'all') return dateFilteredOrders;
    return dateFilteredOrders.filter((o) => o.orderType === orderTypeFilter);
  }, [dateFilteredOrders, orderTypeFilter]);

  const filteredTotal = useMemo(() => {
    return filteredOrders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
  }, [filteredOrders]);

  const summary = useMemo(() => {
    const sd = (startDate || '').split('T')[0];
    const ed = (endDate || '').split('T')[0];
    const fullMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastD = new Date(year, month, 0).getDate();
    const fullMonthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
    const isFullMonth = sd === fullMonthStart && ed === fullMonthEnd;
    if (isFullMonth) return summaryFromApi;
    const ext = dateFilteredOrders.filter((o) => o.orderType === 'external');
    const pettyCash = ext.reduce((s, o) => s + Number(o.pettyCashAmount ?? 0), 0);
    const delegatePurchases = ext.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
    return {
      pettyCashTotal: pettyCash,
      delegatePurchasesTotal: delegatePurchases,
      delegateBalance: pettyCash - delegatePurchases,
      localPurchasesTotal: dateFilteredOrders.filter((o) => o.orderType === 'internal').reduce((s, o) => s + Number(o.totalAmount ?? 0), 0),
    };
  }, [summaryFromApi, dateFilteredOrders, startDate, endDate, year, month]);

  const cumulativeRemainingByOrderId = useMemo(() => {
    const sorted = [...dateFilteredOrders].sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));
    const map = new Map();
    let cumPetty = 0;
    let cumPurch = 0;
    for (const o of sorted) {
      if (o.orderType === 'external') {
        cumPetty += Number(o.pettyCashAmount ?? 0);
        cumPurch += Number(o.totalAmount ?? 0);
        map.set(o.id, cumPetty - cumPurch);
      }
    }
    return map;
  }, [dateFilteredOrders]);

  const ordersColumns = useMemo(
    () => [
      {
        key: 'orderNumber',
        label: t('orderNumber'),
        minWidth: 100,
        align: 'center',
        shrink: true,
        render: (v) => <span className="nx-cell-num nx-cell-num--blue whitespace-nowrap">{v}</span>,
      },
      {
        key: 'orderDate',
        label: t('orderDate'),
        minWidth: 115,
        align: 'center',
        render: (v) => <span className="whitespace-nowrap">{formatSaudiDate(v)}</span>,
      },
      {
        key: 'orderType',
        label: t('orderType'),
        align: 'center',
        shrink: true,
        render: (v) => {
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
        render: (items) => (items ?? []).length,
      },
      {
        key: 'pettyCashAmount',
        label: t('ordersPettyCashGiven'),
        align: 'center',
        shrink: true,
        render: (v, o) =>
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
        render: (v) => <span className="nx-cell-num font-bold whitespace-nowrap"><FmtNum n={Number(v ?? 0)} /> SR</span>,
      },
      {
        key: 'id',
        label: t('ordersCumulativeRemaining'),
        align: 'center',
        shrink: true,
        render: (_, o) => {
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
        render: (_, o) => (
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
    (o) => {
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

  function handleWhatsApp(order) {
    const text = encodeURIComponent(buildWhatsAppText(order, t));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function handleEdit(order) {
    setEditingOrder(order);
    setShowModal(true);
  }

  function handleDelete(order) {
    if (!window.confirm(t('ordersDeleteConfirm', order.orderNumber))) return;
    cancelOrder.mutate(order.id, {
      onSuccess: () => showToast(t('ordersOrderCancelled'), 'success'),
      onError: (e) => showToast(e?.message || t('deleteFailed'), 'error'),
    });
  }

  function handleView(order) {
    setViewingOrder(order);
  }

  const handleExportSingleOrder = async (order) => {
    try {
      const items = order.items ?? [];
      const rows = items.map((it) => ({
        [t('orderNumber')]: order.orderNumber,
        [t('orderDate')]: formatSaudiDate(order.orderDate),
        [t('orderType')]: order.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal'),
        [t('product')]: it.product?.nameAr || it.product?.nameEn || '—',
        [t('ordersProductSize')]: it.size || '—',
        [t('ordersProductPackaging')]: it.packaging || '—',
        [t('unit')]: it.unit || '—',
        [t('quantity')]: it.quantity,
        [t('unitPrice')]: fmt(it.unitPrice ?? 0),
        [t('total')]: fmt(it.amount ?? 0),
      }));
      if (rows.length === 0) {
        rows.push({
          [t('orderNumber')]: order.orderNumber,
          [t('orderDate')]: formatSaudiDate(order.orderDate),
          [t('orderType')]: order.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal'),
          [t('product')]: '—',
          [t('ordersProductSize')]: '—',
          [t('ordersProductPackaging')]: '—',
          [t('unit')]: '—',
          [t('quantity')]: 0,
          [t('unitPrice')]: '—',
          [t('total')]: fmt(order.totalAmount ?? 0),
        });
      } else {
        rows.push({
          [t('orderNumber')]: '',
          [t('orderDate')]: '',
          [t('orderType')]: '',
          [t('product')]: '',
          [t('ordersProductSize')]: '',
          [t('ordersProductPackaging')]: '',
          [t('unit')]: '',
          [t('quantity')]: '',
          [t('unitPrice')]: '',
          [t('total')]: t('total') + ': ' + fmt(order.totalAmount ?? 0) + ' SR',
        });
      }
      await exportToExcel(rows, `order-${order.orderNumber}.xlsx`);
      showToast(t('exportSuccess'), 'success');
    } catch (e) {
      showToast(e?.message || t('exportFailed'), 'error');
    }
  };

  const handlePrintOrder = (order) => {
    const bodyHtml = buildOrderPrintHtml(order, companyName, t, fmt, formatSaudiDate);
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

  const companyName = companies.find((c) => c.id === companyId)?.nameAr || companies.find((c) => c.id === companyId)?.nameEn || '';
  const printDate = `${year}/${String(month).padStart(2, '0')}`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="noorix-print-header hidden print:block">
        {companyName} — {t('ordersTab')} — {printDate}
      </div>

      <div className="noorix-print-hide nx-page-header nx-page-header--filter-row">
        <DateFilterBar filter={dateFilter} />
        <div className="nx-toolbar">
          <Button variant="primary" size="sm" className="noorix-print-hide" onClick={() => { setEditingOrder(null); setShowModal(true); }}>
            + {t('ordersNewOrder')}
          </Button>
        </div>
      </div>

      <OrdersSummaryCard summary={summary} cashSalesTotal={cashSalesTotal} isLoading={summaryLoading} />

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
        renderMobileCard={ordersRenderMobileCard}
        stripeMobileCards
        badge={
          <div className="noorix-print-hide flex flex-wrap items-center gap-2 w-full min-w-0">
            <span className="text-[13px] font-semibold text-noorix-muted shrink-0">{t('ordersFilterByType')}:</span>
            <div className="nx-toolbar flex-wrap">
              {['all', 'external', 'internal'].map((v) => (
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
          onError={(msg) => showToast(msg || t('saveFailed'), 'error')}
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
              { key: '_idx', label: '#', shrink: true, render: (_, _row, i) => <span className="nx-cell-muted">{i + 1}</span> },
              {
                key: 'product',
                label: t('product'),
                render: (_, it) => (
                  <>
                    {it.product?.nameAr || it.product?.nameEn || '—'}
                    {[it.size, it.packaging, it.unit].filter(Boolean).length > 0 && (
                      <span className="nx-cell-muted text-[12px]"> ({[it.size, it.packaging, it.unit].filter(Boolean).join(' / ')})</span>
                    )}
                  </>
                ),
              },
              { key: 'quantity', label: t('quantity'), numeric: true, align: 'center' },
              { key: 'unitPrice', label: t('unitPrice'), numeric: true, render: (v) => `${fmt(v ?? 0)} SR` },
              { key: 'amount',    label: t('total'),    numeric: true, render: (v) => <span className="font-semibold"><FmtNum n={v ?? 0} /> SR</span> },
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
