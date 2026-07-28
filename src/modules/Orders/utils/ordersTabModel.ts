import { fmt } from '../../../utils/format';
import { normalizeDateSpan, toYmdOnly } from '../../../utils/datePeriod';
import { buildPrintTableHtml } from '../../../utils/printTableHtml';
import { formatSaudiDate } from '../../../utils/saudiDate';
import type { OrderProduct, OrderRecord } from '../../../types/api';

export function mergeOrderCatalogProducts(orderCatalog: OrderProduct[], editingOrder: OrderRecord | null): OrderProduct[] {
  const byId = new Map<string, OrderProduct>();
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
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const normalizedStart = toYmdOnly(propStartDate);
  const normalizedEnd = toYmdOnly(propEndDate);
  return normalizeDateSpan(
    datePattern.test(normalizedStart) ? normalizedStart : monthStart,
    datePattern.test(normalizedEnd) ? normalizedEnd : monthEnd,
  );
}

function ymdOnly(value: string | null | undefined): string {
  return (value || '').split('T')[0] || value || '';
}

export function filterOrdersByDate(orders: OrderRecord[], startDate: string, endDate: string): OrderRecord[] {
  const sd = ymdOnly(startDate);
  const ed = ymdOnly(endDate);
  if (!sd || !ed) return orders ?? [];
  return (orders ?? []).filter((o) => {
    const od = ymdOnly(o.orderDate);
    return od >= sd && od <= ed;
  });
}

export function filterOrdersByType(orders: OrderRecord[], orderTypeFilter: string): OrderRecord[] {
  if (orderTypeFilter === 'all') return orders ?? [];
  return (orders ?? []).filter((o) => o.orderType === orderTypeFilter);
}

export function computeOrdersTotal(orders: OrderRecord[]): number {
  return (orders ?? []).reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0);
}

export function computeCumulativeRemainingByOrderId(dateFilteredOrders: OrderRecord[]): Map<string, number> {
  const sorted = [...(dateFilteredOrders ?? [])].sort(
    (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime(),
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

type TranslateFn = (key: string, ...args: string[]) => string;

export function buildWhatsAppText(order: OrderRecord, t: TranslateFn): string {
  const lines = (order.items || [])
    .map((it) => {
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

export function buildOrderPrintHtml(order: OrderRecord, t: TranslateFn): string {
  const items = order.items ?? [];
  const rows = items.map((it) => {
    const parts = [it.size, it.packaging, it.unit].filter(Boolean);
    const name =
      (it.product?.nameAr || it.product?.nameEn || '—') +
      (parts.length > 0 ? ` (${parts.join(' / ')})` : '');
    return {
      product: name,
      quantity: it.quantity,
      unitPrice: `${fmt(it.unitPrice ?? 0)} SR`,
      total: `${fmt(it.amount ?? 0)} SR`,
    };
  });
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
  return `${meta}${buildPrintTableHtml({
    columns: [
      { key: 'product', header: t('product') },
      { key: 'quantity', header: t('quantity'), align: 'center' },
      { key: 'unitPrice', header: t('unitPrice'), align: 'end' },
      { key: 'total', header: t('total'), align: 'end' },
    ],
    rows,
    footerRows: [[
      { value: t('total'), colSpan: 3 },
      { value: `${fmt(order.totalAmount ?? 0)} SR`, align: 'end' },
    ]],
  })}`;
}

export function buildSingleOrderExportRows(order: OrderRecord, t: TranslateFn): Record<string, string | number>[] {
  const items = order.items ?? [];
  const rows: Record<string, string | number>[] = items.map((it) => ({
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
