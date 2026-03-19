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

  const { data: orders = [], isLoading } = useOrders(companyId, year, month);
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

  // المتبقي التراكمي للمندوب: لكل طلب خارجي، الرصيد بعد ذلك الطلب
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
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="noorix-print-header" style={{ display: 'none' }}>
        {companyName} — {t('ordersTab')} — {printDate}
      </div>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div className="noorix-print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <DateFilterBar filter={dateFilter} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="noorix-btn-nav noorix-btn-primary noorix-print-hide" onClick={() => { setEditingOrder(null); setShowModal(true); }}>
            + {t('ordersNewOrder')}
          </button>
        </div>
      </div>

      <OrdersSummaryCard summary={summary} cashSalesTotal={cashSalesTotal} isLoading={summaryLoading} />

      <div className="noorix-surface-card" style={{ overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{t('loading')}</div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{t('ordersNoOrdersInPeriod')}</div>
        ) : dateFilteredOrders.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{t('ordersNoOrdersInRange')}</div>
        ) : (
          <>
            <div className="noorix-print-hide" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--noorix-border)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--noorix-text-muted)' }}>{t('ordersFilterByType')}:</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', 'external', 'internal'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="noorix-btn-nav"
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
                  </button>
                ))}
              </div>
              <span style={{ marginRight: 'auto', fontSize: 14, fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)' }}>
                {t('ordersFilteredTotal')}: {fmt(filteredTotal, 2)} ﷼
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--noorix-border)' }}>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, borderRight: '2px solid var(--noorix-border)' }}>{t('orderNumber')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, borderRight: '2px solid var(--noorix-border)' }}>{t('orderDate')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, borderRight: '2px solid var(--noorix-border)' }}>{t('orderType')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, borderRight: '2px solid var(--noorix-border)' }}>{t('ordersTotalItems')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, borderRight: '2px solid var(--noorix-border)' }}>{t('ordersPettyCashGiven')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, borderRight: '2px solid var(--noorix-border)' }}>{t('total')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, borderRight: '2px solid var(--noorix-border)' }}>{t('ordersCumulativeRemaining')}</th>
                  <th className="noorix-print-hide" style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 700, borderLeft: '2px solid var(--noorix-border)', borderInlineStart: '2px solid var(--noorix-border)' }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => {
                  const pettyGiven = o.orderType === 'external' ? Number(o.pettyCashAmount ?? 0) : null;
                  const cumRem = o.orderType === 'external' ? cumulativeRemainingByOrderId.get(o.id) : null;
                  return (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--noorix-border)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--noorix-font-numbers)', borderRight: '2px solid var(--noorix-border)' }}>{o.orderNumber}</td>
                    <td style={{ padding: '10px 12px', borderRight: '2px solid var(--noorix-border)' }}>{formatSaudiDate(o.orderDate)}</td>
                    <td style={{ padding: '10px 12px', borderRight: '2px solid var(--noorix-border)' }}>
                      {o.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal')}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--noorix-font-numbers)', borderRight: '2px solid var(--noorix-border)' }}>{(o.items ?? []).length}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--noorix-font-numbers)', color: pettyGiven != null ? '#2563eb' : 'var(--noorix-text-muted)', borderRight: '2px solid var(--noorix-border)' }}>
                      {pettyGiven != null ? fmt(pettyGiven, 2) : '—'}{pettyGiven != null ? ' ﷼' : ''}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 600, borderRight: '2px solid var(--noorix-border)' }}>{fmt(o.totalAmount ?? 0, 2)} ﷼</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 600, color: cumRem != null ? (cumRem >= 0 ? '#16a34a' : '#dc2626') : 'var(--noorix-text-muted)', borderRight: '2px solid var(--noorix-border)' }}>
                      {cumRem != null ? (cumRem >= 0 ? '' : '−') + fmt(Math.abs(cumRem ?? 0), 2) + ' ﷼' : '—'}
                    </td>
                    <td className="noorix-print-hide" style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', borderLeft: '2px solid var(--noorix-border)', borderInlineStart: '2px solid var(--noorix-border)' }}>
                      <button type="button" className="noorix-btn-nav" onClick={() => handleView(o)} title={t('ordersViewOrder')} style={{ padding: '6px 10px', fontSize: 12 }}>{t('view')}</button>
                      <button type="button" className="noorix-btn-nav" onClick={() => handleWhatsApp(o)} title={t('sendWhatsApp')} style={{ padding: '6px 10px', fontSize: 12 }}>📱</button>
                      <button type="button" className="noorix-btn-nav" onClick={() => handleEdit(o)} title={t('edit')} style={{ padding: '6px 10px', fontSize: 12 }}>{t('edit')}</button>
                      <button type="button" className="noorix-btn-nav" onClick={() => handleDelete(o)} title={t('delete')} style={{ padding: '6px 10px', fontSize: 12, color: '#dc2626' }}>{t('delete')}</button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--noorix-border)', background: 'var(--noorix-bg-muted)' }}>
                  <td colSpan={5} style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right', borderRight: '2px solid var(--noorix-border)' }}>{t('ordersFilteredTotal')}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700, borderRight: '2px solid var(--noorix-border)' }}>{fmt(filteredTotal, 2)} ﷼</td>
                  <td colSpan={2} style={{ padding: '10px 12px' }} />
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
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={() => setViewingOrder(null)}>
          <div
            className="noorix-surface-card"
            style={{
              maxWidth: 580, width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              borderRadius: 12, border: '1px solid var(--noorix-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px',
              background: 'linear-gradient(135deg, var(--noorix-accent-blue) 0%, #1d4ed8 100%)', color: '#fff', borderRadius: '12px 12px 0 0',
            }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>{companyName}</div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{t('ordersViewOrder')} — {viewingOrder.orderNumber}</h2>
              </div>
              <button type="button" onClick={() => setViewingOrder(null)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{t('close')}</button>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16, marginBottom: 24,
                padding: 16, background: 'var(--noorix-bg-muted)', borderRadius: 10, border: '1px solid var(--noorix-border)',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('orderDate')}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--noorix-font-numbers)' }}>{formatSaudiDate(viewingOrder.orderDate)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('orderType')}</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>
                    {viewingOrder.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal')}
                  </div>
                </div>
                {viewingOrder.orderType === 'external' && viewingOrder.pettyCashAmount != null && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ordersPettyCashGiven')}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--noorix-font-numbers)', color: '#2563eb' }}>{fmt(viewingOrder.pettyCashAmount ?? 0, 2)} ﷼</div>
                  </div>
                )}
              </div>

              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--noorix-text)' }}>{t('orderItems')}</div>
              <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--noorix-border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--noorix-bg-muted)', borderBottom: '2px solid var(--noorix-border)' }}>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>#</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>{t('product')}</th>
                      <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700 }}>{t('quantity')}</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>{t('unitPrice')}</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingOrder.items ?? []).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--noorix-border)' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--noorix-font-numbers)', color: 'var(--noorix-text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 16px' }}>{it.product?.nameAr || it.product?.nameEn || '—'}{[it.size, it.packaging, it.unit].filter(Boolean).length > 0 ? <span style={{ color: 'var(--noorix-text-muted)', fontSize: 12 }}> ({[it.size, it.packaging, it.unit].filter(Boolean).join(' / ')})</span> : ''}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'var(--noorix-font-numbers)' }}>{it.quantity}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(it.unitPrice ?? 0, 2)} ﷼</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 600 }}>{fmt(it.amount ?? 0, 2)} ﷼</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--noorix-bg-muted)', borderTop: '2px solid var(--noorix-border)' }}>
                      <td colSpan={4} style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>{t('total')}</td>
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700, fontSize: 15 }}>{fmt(viewingOrder.totalAmount ?? 0, 2)} ﷼</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--noorix-border)' }}>
                <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={() => handlePrintOrder(viewingOrder)} style={{ padding: '10px 20px', fontSize: 14 }}>
                  🖨 {t('ordersPrintOrder')}
                </button>
                <button type="button" className="noorix-btn-nav" onClick={() => handleExportSingleOrder(viewingOrder)} style={{ padding: '10px 20px', fontSize: 14 }}>
                  📥 {t('exportExcel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
