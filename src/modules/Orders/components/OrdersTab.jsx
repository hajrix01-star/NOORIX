/**
 * OrdersTab — تبويبة الطلبات
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
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
import Toast from '../../../components/Toast';
import DateFilterBar from '../../../shared/components/DateFilterBar';
import { OrderFormModal } from './OrderFormModal';
import { OrdersSummaryCard } from './OrdersSummaryCard';
import { Button, Badge, AdaptiveSheet } from '../../../ui';

function buildWhatsAppText(order, t) {
  const lines = (order.items || []).map((it) => {
    const name = it.product?.nameAr || it.product?.nameEn || '—';
    const parts = [it.size, it.packaging, it.unit].filter(Boolean);
    const variantPart = parts.length > 0 ? ` (${parts.join(' / ')})` : '';
    return `${name}${variantPart}: ${it.quantity} × ${fmt(it.unitPrice ?? 0, 2)} = ${fmt(it.amount ?? 0, 2)} ﷼`;
  }).join('\n');
  const total = fmt(order.totalAmount ?? 0, 2);
  return `طلب ${order.orderNumber}\nالتاريخ: ${formatSaudiDate(order.orderDate)}\nالنوع: ${order.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal')}\n\n${lines}\n\nالإجمالي: ${total} ﷼`;
}

function buildOrderPrintHtml(order, companyName, t, fmt, formatSaudiDate) {
  const items = order.items ?? [];
  const rows = items.map((it) => {
    const parts = [it.size, it.packaging, it.unit].filter(Boolean);
    const name = (it.product?.nameAr || it.product?.nameEn || '—') + (parts.length > 0 ? ` (${parts.join(' / ')})` : '');
    return `<tr><td style="padding:8px 10px;text-align:right;border:1px solid #ddd">${name}</td><td style="padding:8px 10px;text-align:center;border:1px solid #ddd">${it.quantity}</td><td style="padding:8px 10px;text-align:right;border:1px solid #ddd">${fmt(it.unitPrice ?? 0, 2)} ﷼</td><td style="padding:8px 10px;text-align:right;border:1px solid #ddd;font-weight:600">${fmt(it.amount ?? 0, 2)} ﷼</td></tr>`;
  }).join('');
  const orderType = order.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal');
  const pettyRow = order.orderType === 'external' && order.pettyCashAmount != null
    ? `<div style="margin-bottom:8px"><strong>${t('ordersPettyCashGiven')}:</strong> ${fmt(order.pettyCashAmount ?? 0, 2)} ﷼</div>`
    : '';
  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${t('ordersPrintOrder')} - ${order.orderNumber}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>body{font-family:'Cairo',Arial,sans-serif;padding:24px;direction:rtl;color:#1a1a1a;max-width:600px;margin:0 auto}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{padding:10px 12px;text-align:right;border:1px solid #ddd}th{background:#2563eb;color:#fff;font-weight:700}.header{border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:16px}.total-row{background:#f1f5f9;font-weight:700}</style></head><body>
<div class="header"><div style="font-size:20px;font-weight:700;margin-bottom:4px">${companyName}</div><div style="font-size:14px;color:#64748b">${t('ordersViewOrder')} — ${order.orderNumber}</div></div>
<div style="margin-bottom:16px"><div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:8px"><span><strong>${t('orderDate')}:</strong> ${formatSaudiDate(order.orderDate)}</span><span><strong>${t('orderType')}:</strong> ${orderType}</span></div>${pettyRow}</div>
<table><thead><tr><th style="text-align:right">${t('product')}</th><th style="text-align:center">${t('quantity')}</th><th style="text-align:right">${t('unitPrice')}</th><th style="text-align:right">${t('total')}</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total-row"><td colspan="3" style="text-align:right;padding:10px">${t('total')}</td><td style="padding:10px">${fmt(order.totalAmount ?? 0, 2)} ﷼</td></tr></tfoot></table>
</body></html>`;
}

export function OrdersTab({ companyId, year, month, startDate: propStartDate, endDate: propEndDate, dateFilter }) {
  const { t } = useTranslation();
  const { companies = [] } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
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
      onSuccess: () => setToast({ visible: true, message: t('ordersOrderCancelled'), type: 'success' }),
      onError: (e) => setToast({ visible: true, message: e?.message || t('deleteFailed'), type: 'error' }),
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
        [t('unitPrice')]: fmt(it.unitPrice ?? 0, 2),
        [t('total')]: fmt(it.amount ?? 0, 2),
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
          [t('total')]: fmt(order.totalAmount ?? 0, 2),
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
          [t('total')]: t('total') + ': ' + fmt(order.totalAmount ?? 0, 2) + ' ﷼',
        });
      }
      await exportToExcel(rows, `order-${order.orderNumber}.xlsx`);
      setToast({ visible: true, message: t('exportSuccess'), type: 'success' });
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('exportFailed'), type: 'error' });
    }
  };

  const handlePrintOrder = (order) => {
    const html = buildOrderPrintHtml(order, companyName, t, fmt, formatSaudiDate);
    const w = window.open('', '_blank');
    if (!w) {
      setToast({ visible: true, message: t('allowPopupsForPrint'), type: 'error' });
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.onafterprint = () => w.close();
    }, 350);
  };

  function closeModal() {
    setShowModal(false);
    setEditingOrder(null);
  }

  const companyName = companies.find((c) => c.id === companyId)?.nameAr || companies.find((c) => c.id === companyId)?.nameEn || '';
  const printDate = `${year}/${String(month).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="noorix-print-header hidden print:block">
        {companyName} — {t('ordersTab')} — {printDate}
      </div>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div className="noorix-print-hide nx-page-header nx-page-header--filter-row">
        <DateFilterBar filter={dateFilter} />
        <div className="nx-toolbar">
          <Button variant="primary" className="noorix-print-hide" onClick={() => { setEditingOrder(null); setShowModal(true); }}>
            + {t('ordersNewOrder')}
          </Button>
        </div>
      </div>

      <OrdersSummaryCard summary={summary} cashSalesTotal={cashSalesTotal} isLoading={summaryLoading} />

      <div className="noorix-surface-card overflow-auto">
        {ordersError ? (
          <div className="text-center text-noorix-red p-10">⚠ {ordersError?.message || t('loadingError')}</div>
        ) : isLoading ? (
          <div className="text-center text-noorix-muted p-10">{t('loading')}</div>
        ) : orders.length === 0 ? (
          <div className="text-center text-noorix-muted p-10">{t('ordersNoOrdersInPeriod')}</div>
        ) : dateFilteredOrders.length === 0 ? (
          <div className="text-center text-noorix-muted p-10">{t('ordersNoOrdersInRange')}</div>
        ) : (
          <>
            <div className="noorix-print-hide nx-section-header">
              <span className="text-[13px] font-semibold text-noorix-muted">{t('ordersFilterByType')}:</span>
              <div className="nx-toolbar">
                {['all', 'external', 'internal'].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    style={{
                      padding: '6px 14px',
                      fontSize: 12,
                      background: orderTypeFilter === v ? 'var(--noorix-accent-blue)' : 'transparent',
                      borderColor: orderTypeFilter === v ? 'var(--noorix-accent-blue)' : 'var(--noorix-border)',
                      color: orderTypeFilter === v ? '#fff' : 'var(--noorix-text)',
                    }}
                    onClick={() => setOrderTypeFilter(v)}
                  >
                    {v === 'all' ? t('ordersFilterAll') : v === 'external' ? t('orderTypeExternal') : t('orderTypeInternal')}
                  </Button>
                ))}
              </div>
              <span className="text-[14px] font-bold nx-font-numbers me-auto">
                {t('ordersFilteredTotal')}: {fmt(filteredTotal, 2)} ﷼
              </span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr style={{
                  background: 'linear-gradient(135deg, var(--noorix-accent-blue, #2563eb) 0%, #1d4ed8 100%)',
                }}>
                  {[
                    t('orderNumber'), t('orderDate'), t('orderType'),
                    t('ordersTotalItems'), t('ordersPettyCashGiven'),
                    t('orderTotalAmount') || 'مشتريات المندوب',
                    t('ordersCumulativeRemaining'), t('actions'),
                  ].map((label, i) => (
                    <th
                      key={label}
                      className={`${i === 7 ? 'noorix-print-hide' : ''} text-center whitespace-nowrap font-bold py-[11px] px-[14px] text-[12px] tracking-[0.02em]`.trim()}
                      style={{
                        color: 'white',
                        borderInlineEnd: i < 7 ? '1px solid rgba(255,255,255,0.15)' : 'none',
                      }}
                    >{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o, rowIdx) => {
                  const pettyGiven = o.orderType === 'external' ? Number(o.pettyCashAmount ?? 0) : null;
                  const cumRem = o.orderType === 'external' ? cumulativeRemainingByOrderId.get(o.id) : null;
                  const isExt = o.orderType === 'external';
                  const rowBg = rowIdx % 2 === 0 ? 'var(--noorix-bg-surface)' : 'var(--noorix-bg-muted)';
                  return (
                  <tr
                    key={o.id}
                    className="border-b border-noorix-border"
                    style={{ background: rowBg, transition: 'background 0.12s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--noorix-blue-5)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = rowBg; }}
                  >
                    <td className="nx-cell-num nx-cell-num--blue text-center whitespace-nowrap py-[11px] px-[14px] border-e border-noorix-border">
                      {o.orderNumber}
                    </td>
                    <td className="text-center whitespace-nowrap py-[11px] px-[14px] border-e border-noorix-border">
                      {formatSaudiDate(o.orderDate)}
                    </td>
                    <td className="text-center py-[11px] px-[14px] border-e border-noorix-border">
                      <Badge color={isExt ? 'blue' : 'green'} size="sm">
                        {isExt ? t('orderTypeExternal') : t('orderTypeInternal')}
                      </Badge>
                    </td>
                    <td className="nx-cell-num text-center py-[11px] px-[14px] border-e border-noorix-border">
                      {(o.items ?? []).length}
                    </td>
                    <td className="text-center whitespace-nowrap py-[11px] px-[14px] border-e border-noorix-border">
                      {pettyGiven != null ? (
                        <span className="nx-cell-num nx-cell-num--blue">{fmt(pettyGiven, 2)} ﷼</span>
                      ) : <span className="nx-cell-muted">—</span>}
                    </td>
                    <td className="nx-cell-num font-bold text-center whitespace-nowrap py-[11px] px-[14px] border-e border-noorix-border">
                      {fmt(o.totalAmount ?? 0, 2)} ﷼
                    </td>
                    <td className="text-center whitespace-nowrap py-[11px] px-[14px] border-e border-noorix-border">
                      {cumRem != null ? (
                        <Badge color={cumRem >= 0 ? 'green' : 'red'} size="sm">
                          {cumRem >= 0 ? '' : '−'}{fmt(Math.abs(cumRem ?? 0), 2)} ﷼
                        </Badge>
                      ) : <span className="nx-cell-muted">—</span>}
                    </td>
                    <td className="noorix-print-hide text-center whitespace-nowrap py-2 px-2.5">
                      <div className="nx-toolbar justify-center">
                        <Button size="sm" onClick={() => handleView(o)} title={t('ordersViewOrder')}>{t('view')}</Button>
                        <Button size="sm" onClick={() => handleWhatsApp(o)} title={t('sendWhatsApp')}>{t('sendWhatsApp')}</Button>
                        <Button size="sm" onClick={() => handleEdit(o)} title={t('edit')}>{t('edit')}</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(o)} title={t('delete')}>{t('delete')}</Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--noorix-blue-6)] border-t-2 border-noorix-blue">
                  <td colSpan={5} className="font-bold text-center py-[11px] px-[14px]">{t('ordersFilteredTotal')}</td>
                  <td className="nx-cell-num nx-cell-num--blue font-extrabold text-center text-[14px] py-[11px] px-[14px]">{fmt(filteredTotal, 2)} ﷼</td>
                  <td colSpan={2} className="noorix-print-hide py-[11px] px-[14px]" />
                </tr>
              </tfoot>
            </table>
          </div>
          </>
        )}
      </div>

      {showModal && (
        <OrderFormModal
          companyId={companyId}
          products={products}
          initialOrder={editingOrder}
          createOrder={createOrder}
          updateOrder={updateOrder}
          onSuccess={() => setToast({ visible: true, message: editingOrder ? t('ordersOrderUpdated') : t('orderSaved'), type: 'success' })}
          onError={(msg) => setToast({ visible: true, message: msg || t('saveFailed'), type: 'error' })}
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
              <Button variant="primary" onClick={() => handlePrintOrder(viewingOrder)}>
                {t('ordersPrintOrder')}
              </Button>
              <Button onClick={() => handleExportSingleOrder(viewingOrder)}>
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
                <div className="nx-cell-num nx-cell-num--blue text-[15px] font-semibold">{fmt(viewingOrder.pettyCashAmount ?? 0, 2)} ﷼</div>
              </div>
            )}
          </div>

          <div className="text-[16px] font-bold mb-3">{t('orderItems')}</div>
          <div className="border border-noorix-border overflow-x-auto rounded-[10px]">
            <table className="w-full border-collapse text-[13px] min-w-[480px]">
              <thead>
                <tr className="bg-noorix-bg-muted border-b-2 border-noorix-border">
                  <th className="text-end font-bold py-3 px-4">#</th>
                  <th className="text-end font-bold py-3 px-4">{t('product')}</th>
                  <th className="text-center font-bold py-3 px-4">{t('quantity')}</th>
                  <th className="text-end font-bold py-3 px-4">{t('unitPrice')}</th>
                  <th className="text-end font-bold py-3 px-4">{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {(viewingOrder.items ?? []).map((it, idx) => (
                  <tr key={idx} className="border-b border-noorix-border">
                    <td className="nx-cell-muted py-3 px-4">{idx + 1}</td>
                    <td className="py-3 px-4">{it.product?.nameAr || it.product?.nameEn || '—'}{[it.size, it.packaging, it.unit].filter(Boolean).length > 0 ? <span className="nx-cell-muted text-[12px]"> ({[it.size, it.packaging, it.unit].filter(Boolean).join(' / ')})</span> : ''}</td>
                    <td className="nx-cell-num text-center py-3 px-4">{it.quantity}</td>
                    <td className="nx-cell-num py-3 px-4">{fmt(it.unitPrice ?? 0, 2)} ﷼</td>
                    <td className="nx-cell-num font-semibold py-3 px-4">{fmt(it.amount ?? 0, 2)} ﷼</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-noorix-bg-muted border-t-2 border-noorix-border">
                  <td colSpan={4} className="font-bold text-end py-[14px] px-4">{t('total')}</td>
                  <td className="nx-cell-num font-bold text-[15px] py-[14px] px-4">{fmt(viewingOrder.totalAmount ?? 0, 2)} ﷼</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </AdaptiveSheet>
      )}
    </div>
  );
}
