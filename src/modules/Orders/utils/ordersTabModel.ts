import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';

export function mergeOrderCatalogProducts(orderCatalog: any[], editingOrder: any): any[] {
  const byId = new Map<string, any>();
  for (const p of orderCatalog ?? []) byId.set(p.id, p);
  const lineItems = editingOrder?.items;
  if (Array.isArray(lineItems)) {
    for (const it of lineItems) {
      const p = it.product;
      if (p?.id && !byId.has(p.id)) byId.set(p.id, p);
    }
  }
  return Array.from(byId.values());
}

export function resolveOrdersDateRange({
  year,
  month,
  propStartDate,
  propEndDate,
}: {
  year: number;
  month: number;
  propStartDate?: string;
  propEndDate?: string;
}): { startDate: string; endDate: string } {
  const startDate = propStartDate || `${year}-${String(month).padStart(2, '0')}-01`;
  if (propEndDate) return { startDate, endDate: propEndDate };
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

function ymdOnly(value: string | null | undefined): string {
  return (value || '').split('T')[0] || value || '';
}

export function filterOrdersByDate(orders: any[], startDate: string, endDate: string): any[] {
  const sd = ymdOnly(startDate);
  const ed = ymdOnly(endDate);
  if (!sd || !ed) return orders ?? [];
  return (orders ?? []).filter((o: any) => {
    const od = ymdOnly(o.orderDate);
    return od >= sd && od <= ed;
  });
}

export function filterOrdersByType(orders: any[], orderTypeFilter: string): any[] {
  if (orderTypeFilter === 'all') return orders ?? [];
  return (orders ?? []).filter((o: any) => o.orderType === orderTypeFilter);
}

export function computeOrdersTotal(orders: any[]): number {
  return (orders ?? []).reduce((sum: number, o: any) => sum + Number(o.totalAmount ?? 0), 0);
}

export function computeCashSalesTotal(salesData: any): number {
  const items = salesData?.items ?? [];
  return items.reduce((sum: number, summary: any) => {
    const channels = summary.channels ?? [];
    const cashOnly = channels.reduce((acc: number, ch: any) => {
      if (ch?.vault?.type !== 'cash') return acc;
      return acc + Number(ch.amount ?? 0);
    }, 0);
    return sum + cashOnly;
  }, 0);
}

export function computeOrdersSummaryForRange({
  summaryFromApi,
  dateFilteredOrders,
  startDate,
  endDate,
  year,
  month,
}: {
  summaryFromApi: any;
  dateFilteredOrders: any[];
  startDate: string;
  endDate: string;
  year: number;
  month: number;
}): any {
  const sd = ymdOnly(startDate);
  const ed = ymdOnly(endDate);
  const fullMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastD = new Date(year, month, 0).getDate();
  const fullMonthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
  if (sd === fullMonthStart && ed === fullMonthEnd) return summaryFromApi;

  const ext = (dateFilteredOrders ?? []).filter((o: any) => o.orderType === 'external');
  const pettyCash = ext.reduce((s: number, o: any) => s + Number(o.pettyCashAmount ?? 0), 0);
  const delegatePurchases = ext.reduce((s: number, o: any) => s + Number(o.totalAmount ?? 0), 0);
  return {
    pettyCashTotal: pettyCash,
    delegatePurchasesTotal: delegatePurchases,
    delegateBalance: pettyCash - delegatePurchases,
    localPurchasesTotal: (dateFilteredOrders ?? [])
      .filter((o: any) => o.orderType === 'internal')
      .reduce((s: number, o: any) => s + Number(o.totalAmount ?? 0), 0),
  };
}

export function computeCumulativeRemainingByOrderId(dateFilteredOrders: any[]): Map<string, number> {
  const sorted = [...(dateFilteredOrders ?? [])].sort(
    (a: any, b: any) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime(),
  );
  const map = new Map<string, number>();
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
}

export function buildWhatsAppText(order: any, t: any): string {
  const lines = (order.items || [])
    .map((it: any) => {
      const name = it.product?.nameAr || it.product?.nameEn || '—';
      const parts = [it.size, it.packaging, it.unit].filter(Boolean);
      const variantPart = parts.length > 0 ? ` (${parts.join(' / ')})` : '';
      return `${name}${variantPart}: ${it.quantity} × ${fmt(it.unitPrice ?? 0)} = ${fmt(it.amount ?? 0)} SR`;
    })
    .join('\n');
  const total = fmt(order.totalAmount ?? 0);
  return `طلب ${order.orderNumber}\nالتاريخ: ${formatSaudiDate(order.orderDate)}\nالنوع: ${
    order.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal')
  }\n\n${lines}\n\nالإجمالي: ${total} SR`;
}

export function buildOrderPrintHtml(order: any, t: any): string {
  const items = order.items ?? [];
  const rows = items
    .map((it: any) => {
      const parts = [it.size, it.packaging, it.unit].filter(Boolean);
      const name =
        (it.product?.nameAr || it.product?.nameEn || '—') +
        (parts.length > 0 ? ` (${parts.join(' / ')})` : '');
      return `<tr><td>${name}</td><td style="text-align:center">${it.quantity}</td><td>${fmt(
        it.unitPrice ?? 0,
      )} SR</td><td><strong>${fmt(it.amount ?? 0)} SR</strong></td></tr>`;
    })
    .join('');
  const orderType = order.orderType === 'external' ? t('orderTypeExternal') : t('orderTypeInternal');
  const pettyRow =
    order.orderType === 'external' && order.pettyCashAmount != null
      ? `<p style="margin:6px 0"><strong>${t('ordersPettyCashGiven')}:</strong> ${fmt(
          order.pettyCashAmount ?? 0,
        )} SR</p>`
      : '';
  const meta = `<div style="margin-bottom:16px;font-size:13px">
    <p style="margin:4px 0"><strong>${t('orderDate')}:</strong> ${formatSaudiDate(order.orderDate)}</p>
    <p style="margin:4px 0"><strong>${t('orderType')}:</strong> ${orderType}</p>
    ${pettyRow}
  </div>`;
  return `${meta}<table>
<thead><tr><th>${t('product')}</th><th style="text-align:center">${t('quantity')}</th><th>${t(
    'unitPrice',
  )}</th><th>${t('total')}</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="3">${t('total')}</td><td>${fmt(order.totalAmount ?? 0)} SR</td></tr></tfoot>
</table>`;
}

export function buildSingleOrderExportRows(order: any, t: any): any[] {
  const items = order.items ?? [];
  const rows = items.map((it: any) => ({
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
      [t('total')]: `${t('total')}: ${fmt(order.totalAmount ?? 0)} SR`,
    });
  }
  return rows;
}
