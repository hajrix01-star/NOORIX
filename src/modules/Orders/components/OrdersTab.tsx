/**
 * OrdersTab — تبويبة الطلبات
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { hasPermission, PERMISSIONS } from '../../../constants/permissions';
import {
  useOrders,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useCancelOrderMutation,
  useOrdersSummary,
  useOrderProducts,
  useMarkStaffDigestSentMutation,
} from '../../../hooks/useOrders';
import { getDailySalesSummaries } from '../../../services/api';
import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { exportToExcel } from '../../../utils/exportUtils';
import { openPrintWindow } from '../../../utils/printUtils';
import { salesKeys } from '../../../services/queryKeys';
import DateFilterBar from '../../../shared/components/DateFilterBar';
import { OrderFormModal } from './OrderFormModal';
import { OrdersSummaryCard } from './OrdersSummaryCard';
import { Button, Badge, AdaptiveSheet, SmartTable, KebabMenu, FmtNum } from '../../../ui';
import { orderLocalizedName, orderProductDisplayName } from '../../../utils/orderDisplay';

function orderItemLineLabel(it: any, lang: string) {
  if (it.productId && it.product) {
    const name = orderProductDisplayName(it.product, lang);
    const parts = [it.size, it.packaging, it.unit].filter(Boolean);
    const variantPart = parts.length > 0 ? ` (${parts.join(' / ')})` : '';
    return `${name || '—'}${variantPart}`;
  }
  if (it.customLabelAr || it.customLabelEn) {
    return orderLocalizedName(it.customLabelAr, it.customLabelEn, lang);
  }
  return '—';
}

function buildWhatsAppText(order: any, t: any, lang: string) {
  const lines = (order.items || []).map((it: any) => {
    const name = orderItemLineLabel(it, lang);
    return `${name}: ${it.quantity} × ${fmt(it.unitPrice ?? 0)} = ${fmt(it.amount ?? 0)} SR`;
  }).join('\n');
  const total = fmt(order.totalAmount ?? 0);
  return `طلب ${order.orderNumber}\nالتاريخ: ${formatSaudiDate(order.orderDate)}\nالنوع: ${order.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal')}\n\n${lines}\n\nالإجمالي: ${total} SR`;
}

function buildOrderPrintHtml(order: any, companyName: any, t: any, fmt: any, formatSaudiDate: any, lang: string) {
  const items = order.items ?? [];
  const rows = items.map((it: any) => {
    const name = orderItemLineLabel(it, lang);
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

export function OrdersTab({
  companyId,
  year,
  month,
  startDate: propStartDate,
  endDate: propEndDate,
  dateFilter,
  onNavigateToManageItems,
}: {
  companyId: any;
  year: any;
  month: any;
  startDate?: string;
  endDate?: string;
  dateFilter: any;
  onNavigateToManageItems?: () => void;
}) {
  const { t, lang } = useTranslation();
  const { companies = [], userRole, userPermissions = [] } = useApp();
  const canManageCatalog = hasPermission(userRole, PERMISSIONS.ORDERS_WRITE, userPermissions);
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const { showToast } = useToast();
  const [orderTypeFilter, setOrderTypeFilter] = useState('all'); // 'all' | 'external' | 'internal'
  const [viewingOrder, setViewingOrder] = useState<any>(null);

  const { data: orders = [], isLoading, error: ordersError } = useOrders(companyId, year, month);
  const { data: products = [] } = useOrderProducts(companyId);
  const { data: summaryFromApi = {}, isLoading: summaryLoading } = useOrdersSummary(companyId, year, month);
  const createOrder = useCreateOrderMutation();
  const updateOrder = useUpdateOrderMutation(companyId);
  const cancelOrder = useCancelOrderMutation(companyId);
  const markDigestSent = useMarkStaffDigestSentMutation();
  const [digestSelection, setDigestSelection] = useState<string[]>([]);

  const startDate = useMemo(() => propStartDate || `${year}-${String(month).padStart(2, '0')}-01`, [propStartDate, year, month]);
  const endDate = useMemo(() => {
    if (propEndDate) return propEndDate;
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }, [propEndDate, year, month]);

  const { data: salesData } = useQuery({
    queryKey: salesKeys.summaries(companyId, startDate, endDate),
    queryFn: async () => {
      const res = await getDailySalesSummaries(companyId, startDate, endDate, 1, 200);
      if (!res?.success) return { items: [] };
      const items = res.data?.items ?? (Array.isArray(res.data) ? res.data : []);
      return { items: Array.isArray(items) ? items : [] };
    },
    enabled: !!companyId && !!year && !!month,
  });

  /** نقد المحل: مبيعات قناة النقد فقط (خزائن type=cash)، لا إجمالي كل القنوات */
  const cashSalesTotal = useMemo(() => {
    const items = salesData?.items ?? [];
    return items.reduce((sum: any, summary: any) => {
      const channels = summary.channels ?? [];
      const cashOnly = channels.reduce((acc: any, ch: any) => {
        if (ch?.vault?.type !== 'cash') return acc;
        return acc + Number(ch.amount ?? 0);
      }, 0);
      return sum + cashOnly;
    }, 0);
  }, [salesData]);

  const dateFilteredOrders = useMemo(() => {
    const sd = (startDate || '').split('T')[0] || startDate;
    const ed = (endDate || '').split('T')[0] || endDate;
    if (!sd || !ed) return orders;
    return orders.filter((o: any) => {
      const od = (o.orderDate || '').split('T')[0] || o.orderDate || '';
      return od >= sd && od <= ed;
    });
  }, [orders, startDate, endDate]);

  /** طلبات الموظفين المعلّقة لا تُحتسب في ملخص المشتريات حتى يعلّم المدير الإرسال */
  const ordersCountingTowardSummary = useMemo(
    () => dateFilteredOrders.filter((o: any) => !(o.isStaffRequest && !o.staffDigestSentAt)),
    [dateFilteredOrders],
  );

  const pendingStaffForDigest = useMemo(
    () => dateFilteredOrders.filter((o: any) => o.isStaffRequest && !o.staffDigestSentAt),
    [dateFilteredOrders],
  );

  const canMarkStaffDigest = hasPermission(userRole, PERMISSIONS.ORDERS_WRITE, userPermissions);

  const filteredOrders = useMemo(() => {
    if (orderTypeFilter === 'all') return dateFilteredOrders;
    return dateFilteredOrders.filter((o: any) => o.orderType === orderTypeFilter);
  }, [dateFilteredOrders, orderTypeFilter]);

  const filteredTotal = useMemo(() => {
    return filteredOrders.reduce((s: any, o: any) => s + Number(o.totalAmount ?? 0), 0);
  }, [filteredOrders]);

  const summary = useMemo(() => {
    const sd = (startDate || '').split('T')[0];
    const ed = (endDate || '').split('T')[0];
    const fullMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastD = new Date(year, month, 0).getDate();
    const fullMonthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
    const isFullMonth = sd === fullMonthStart && ed === fullMonthEnd;
    if (isFullMonth) return summaryFromApi;
    const ext = ordersCountingTowardSummary.filter((o: any) => o.orderType === 'external');
    const pettyCash = ext.reduce((s: any, o: any) => s + Number(o.pettyCashAmount ?? 0), 0);
    const delegatePurchases = ext.reduce((s: any, o: any) => s + Number(o.totalAmount ?? 0), 0);
    return {
      pettyCashTotal: pettyCash,
      delegatePurchasesTotal: delegatePurchases,
      delegateBalance: pettyCash - delegatePurchases,
      localPurchasesTotal: ordersCountingTowardSummary.filter((o: any) => o.orderType === 'internal').reduce((s: any, o: any) => s + Number(o.totalAmount ?? 0), 0),
    };
  }, [summaryFromApi, ordersCountingTowardSummary, startDate, endDate, year, month]);

  const cumulativeRemainingByOrderId = useMemo(() => {
    const sorted = [...ordersCountingTowardSummary].sort(
      (a: any, b: any) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime(),
    );
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
  }, [ordersCountingTowardSummary]);

  const buildStaffDigestWhatsApp = useCallback(
    (ordersSlice: any[]) => {
      const byCreator = new Map<string, any[]>();
      for (const o of ordersSlice) {
        const k = o.createdBy?.id || '—';
        const g = byCreator.get(k) || [];
        g.push(o);
        byCreator.set(k, g);
      }
      let text = `${t('ordersStaffDigestToolbar')}\n\n`;
      for (const group of byCreator.values()) {
        const u = group[0]?.createdBy;
        const head = lang === 'ar' ? u?.nameAr || u?.nameEn || u?.email : u?.nameEn || u?.nameAr || u?.email;
        text += `—— ${head || '—'} ——\n`;
        for (const o of group) {
          text += `\n#${o.orderNumber} · ${formatSaudiDate(o.orderDate)}\n`;
          for (const it of o.items || []) {
            text += `• ${orderItemLineLabel(it, lang)} : ${it.quantity} × ${fmt(it.unitPrice ?? 0)} = ${fmt(it.amount ?? 0)} SR\n`;
          }
          text += `${t('total')}: ${fmt(o.totalAmount ?? 0)} SR\n`;
        }
      }
      return text.trim();
    },
    [t, lang],
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
        key: 'createdBy',
        label: t('ordersSubmittedBy'),
        minWidth: 120,
        align: 'center',
        shrink: true,
        render: (_: any, o: any) => {
          if (!o.isStaffRequest) return <span className="nx-cell-muted">—</span>;
          const u = o.createdBy;
          const name = lang === 'ar' ? u?.nameAr || u?.nameEn || u?.email : u?.nameEn || u?.nameAr || u?.email;
          const pending = !o.staffDigestSentAt;
          return (
            <div className="flex flex-col items-center gap-1 min-w-0">
              {pending && (
                <Badge color="amber" size="sm">
                  {t('ordersStaffBadge')}
                </Badge>
              )}
              <span className="text-[11px] leading-tight text-center break-words max-w-[140px]">{name || '—'}</span>
            </div>
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
    [t, lang, fmt, formatSaudiDate, cumulativeRemainingByOrderId],
  );

  const ordersFooterCells = useMemo(
    () => (
      <>
        <td colSpan={6} className="font-bold text-center py-[11px] px-[14px]">
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
          {o.isStaffRequest && o.createdBy && (
            <div className="text-[11px] text-noorix-muted text-end">
              {t('ordersSubmittedBy')}:{' '}
              {lang === 'ar'
                ? o.createdBy.nameAr || o.createdBy.nameEn || o.createdBy.email
                : o.createdBy.nameEn || o.createdBy.nameAr || o.createdBy.email}
              {o.isStaffRequest && !o.staffDigestSentAt ? ` · ${t('ordersStaffPendingDigest')}` : ''}
            </div>
          )}
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
    [t, lang, fmt, formatSaudiDate, cumulativeRemainingByOrderId],
  );

  function handleWhatsApp(order: any) {
    const text = encodeURIComponent(buildWhatsAppText(order, t, lang));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function handleEdit(order: any) {
    if (order.isStaffRequest && !order.staffDigestSentAt) {
      showToast(t('ordersStaffEditBlockedManager'), 'error');
      return;
    }
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
      const items = order.items ?? [];
      const rows = items.map((it: any) => ({
        [t('orderNumber')]: order.orderNumber,
        [t('orderDate')]: formatSaudiDate(order.orderDate),
        [t('orderType')]: order.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal'),
        [t('product')]: orderItemLineLabel(it, lang),
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
    } catch (e: any) {
      showToast(e?.message || t('exportFailed'), 'error');
    }
  };

  const handlePrintOrder = (order: any) => {
    const bodyHtml = buildOrderPrintHtml(order, companyName, t, fmt, formatSaudiDate, lang);
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

  const companyRow = companies.find((c: any) => c.id === companyId);
  const companyNameRaw = companyRow ? orderLocalizedName(companyRow.nameAr, companyRow.nameEn, lang) : '—';
  const companyName = companyNameRaw === '—' ? '' : companyNameRaw;
  const printDate = `${year}/${String(month).padStart(2, '0')}`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="noorix-print-header hidden print:block">
        {companyName} — {t('ordersTab')} — {printDate}
      </div>

      <div className="noorix-print-hide nx-page-header nx-page-header--filter-row">
        <DateFilterBar filter={dateFilter} />
        <div className="nx-toolbar flex-wrap gap-2">
          <Button variant="primary" size="sm" className="noorix-print-hide" onClick={() => { setEditingOrder(null); setShowModal(true); }}>
            + {t('ordersNewOrder')}
          </Button>
          {canManageCatalog && typeof onNavigateToManageItems === 'function' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="noorix-print-hide border-2 border-noorix-blue text-noorix-blue font-semibold hover:bg-blue-500/10"
              onClick={() => onNavigateToManageItems()}
            >
              + {t('ordersAddProduct')}
            </Button>
          )}
        </div>
      </div>

      <OrdersSummaryCard summary={summary} cashSalesTotal={cashSalesTotal} isLoading={summaryLoading} />

      {pendingStaffForDigest.length > 0 && (
        <div className="noorix-print-hide noorix-surface-card p-4 rounded-xl border border-noorix-border flex flex-col gap-3">
          <div className="font-bold text-[14px]">{t('ordersStaffDigestToolbar')}</div>
          <p className="text-[12px] text-noorix-muted m-0">
            {digestSelection.length > 0
              ? `${digestSelection.length} / ${pendingStaffForDigest.length}`
              : t('ordersStaffDigestCopyAllHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setDigestSelection(pendingStaffForDigest.map((o: any) => o.id))}>
              {t('ordersStaffDigestSelectPending')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDigestSelection([])}>
              {t('clearSelection')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={async () => {
                const slice = digestSelection.length
                  ? pendingStaffForDigest.filter((o: any) => digestSelection.includes(o.id))
                  : pendingStaffForDigest;
                const txt = buildStaffDigestWhatsApp(slice);
                try {
                  await navigator.clipboard.writeText(txt);
                  showToast(t('ordersStaffDigestCopied'), 'success');
                } catch {
                  showToast(t('exportFailed'), 'error');
                }
              }}
            >
              {t('ordersStaffDigestCopyWa')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const slice = digestSelection.length
                  ? pendingStaffForDigest.filter((o: any) => digestSelection.includes(o.id))
                  : pendingStaffForDigest;
                const txt = buildStaffDigestWhatsApp(slice);
                window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
              }}
            >
              {t('ordersStaffDigestOpenWa')}
            </Button>
            {canMarkStaffDigest && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="border border-noorix-border"
                disabled={digestSelection.length === 0 || markDigestSent.isPending}
                onClick={() => {
                  markDigestSent.mutate(
                    { companyId, orderIds: digestSelection },
                    {
                      onSuccess: () => {
                        showToast(t('ordersStaffDigestMarked'), 'success');
                        setDigestSelection([]);
                      },
                      onError: (e: any) => showToast(e?.message || t('saveFailed'), 'error'),
                    },
                  );
                }}
              >
                {t('ordersStaffDigestMarkSent')}
              </Button>
            )}
          </div>
        </div>
      )}

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
            {viewingOrder.isStaffRequest && viewingOrder.createdBy && (
              <div>
                <div className="text-[11px] text-noorix-muted mb-1 uppercase tracking-[0.05em]">{t('ordersSubmittedBy')}</div>
                <div className="text-[15px] font-semibold">
                  {lang === 'ar'
                    ? viewingOrder.createdBy.nameAr || viewingOrder.createdBy.nameEn || viewingOrder.createdBy.email
                    : viewingOrder.createdBy.nameEn || viewingOrder.createdBy.nameAr || viewingOrder.createdBy.email}
                </div>
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
                render: (_: any, it: any) => <span>{orderItemLineLabel(it, lang)}</span>,
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
