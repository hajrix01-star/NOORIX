import React, { useState } from 'react';
import Decimal from 'decimal.js';
import { useTranslation } from '../../i18n/useTranslation';
import { fmt } from '../../utils/format';
import { formatSaudiDate } from '../../utils/saudiDate';
import { Button, Badge, cn } from '../../ui';
import {
  resolveStaffItemUnitPrice,
  staffItemLineAmount,
  formatVariantLabel,
  staffOrdersTotal,
  staffOrdersQty,
  staffSaleAvgPerOrder,
} from './utils/staffOrderBasketUtils';
export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <Badge color={status === 'sent' ? 'green' : 'amber'} size="sm">
      {status === 'sent' ? t('staffOrderSent') : t('staffOrderPending')}
    </Badge>
  );
}

export function StaffItemPriceSuffix({ it, product }: { it: any; product?: any }) {
  const amountItem = { ...it, product: product ?? it.product };
  const unitPrice = resolveStaffItemUnitPrice(amountItem);
  const lineAmt = staffItemLineAmount(amountItem);
  if (unitPrice.gt(0)) {
    return (
      <> × {fmt(unitPrice.toNumber())} = {fmt(lineAmt.toNumber())} <span className="nx-sar">SR</span></>
    );
  }
  return <> {it.unit || ''}</>;
}

/** ملخص كمية / مجموع / معدل — سطر واحد داخل الكرت */
export function StaffSaleLogMetrics({
  totalQty,
  totalAmount,
  avgPerOrder,
  t,
  showDivider = true,
}: {
  totalQty: number;
  totalAmount: Decimal;
  avgPerOrder: Decimal;
  t: (key: string, ...args: unknown[]) => string;
  showDivider?: boolean;
}) {
  const showMoney = totalAmount.gt(0);
  if (totalQty <= 0 && !showMoney) return null;

  const parts: React.ReactNode[] = [];
  if (totalQty > 0) {
    parts.push(
      <span key="qty" className="ltr whitespace-nowrap">
        <span className="text-noorix-muted">{t('staffSaleTotalQty')}: </span>
        <span className="font-bold text-noorix-blue nx-font-numbers">{fmt(totalQty, 0)}</span>
      </span>,
    );
  }
  if (showMoney) {
    parts.push(
      <span key="sum" className="ltr whitespace-nowrap">
        <span className="text-noorix-muted">{t('staffSaleGrandTotal')}: </span>
        <span className="font-bold text-noorix-green nx-font-numbers">
          {fmt(totalAmount.toNumber())} <span className="nx-sar">SR</span>
        </span>
      </span>,
    );
    if (totalQty > 0) {
      parts.push(
        <span key="avg" className="ltr whitespace-nowrap">
          <span className="text-noorix-muted">{t('avgPerOrder')}: </span>
          <span className="font-bold text-noorix-violet nx-font-numbers">
            {fmt(avgPerOrder.toNumber())} <span className="nx-sar">SR</span>
          </span>
        </span>,
      );
    }
  }

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]',
      showDivider && 'border-t border-noorix-border/60 pt-2',
    )}>
      {parts}
    </div>
  );
}

/** جدول أصناف العملية — قراءة فقط داخل كرت السجل */
export function StaffSaleItemsTable({
  items,
  lang,
  t,
}: {
  items: any[];
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
}) {
  if (!items?.length) return null;
  return (
    <table className="w-full text-[12px] sm:text-[13px] border-collapse min-w-[280px] border border-noorix-border rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-noorix-bg-muted border-b border-noorix-border">
            <th className="text-start py-2 px-2.5 font-bold text-[11px] text-noorix-muted">{t('product')}</th>
            <th className="text-end py-2 px-2.5 font-bold text-[11px] text-noorix-muted w-14">{t('quantity')}</th>
            <th className="text-end py-2 px-2.5 font-bold text-[11px] text-noorix-muted w-16">{t('unitPrice')}</th>
            <th className="text-end py-2 px-2.5 font-bold text-[11px] text-noorix-muted w-[4.5rem]">{t('staffSaleGrandTotal')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it: any, i: number) => {
            const p = it.product;
            const name = lang === 'en' ? (p?.nameEn || p?.nameAr || '—') : (p?.nameAr || p?.nameEn || '—');
            const variant = formatVariantLabel(it.size, it.packaging, it.unit);
            const amountItem = { ...it, product: p };
            const unitPrice = resolveStaffItemUnitPrice(amountItem);
            const lineAmt = staffItemLineAmount(amountItem);
            return (
              <tr key={i} className="border-b border-noorix-border last:border-b-0 hover:bg-noorix-bg-muted/30">
                <td className="py-2 px-2.5 align-top text-start max-w-[140px] sm:max-w-none">
                  <div className="font-medium text-noorix-text break-words leading-snug">{name}</div>
                  {variant ? (
                    <div className="text-[10px] text-noorix-muted ltr mt-0.5 truncate" title={variant}>{variant}</div>
                  ) : null}
                </td>
                <td className="py-2 px-2.5 text-end nx-font-numbers ltr font-semibold align-top whitespace-nowrap">
                  {fmt(it.quantity, 0)}
                </td>
                <td className="py-2 px-2.5 text-end nx-font-numbers ltr align-top whitespace-nowrap">
                  {unitPrice.gt(0) ? (
                    <>{fmt(unitPrice.toNumber())} <span className="nx-sar">SR</span></>
                  ) : (
                    <span className="text-noorix-muted">—</span>
                  )}
                </td>
                <td className="py-2 px-2.5 text-end nx-font-numbers ltr font-bold text-noorix-green align-top whitespace-nowrap">
                  {lineAmt.gt(0) ? (
                    <>{fmt(lineAmt.toNumber())} <span className="nx-sar">SR</span></>
                  ) : (
                    <span className="text-noorix-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
  );
}

/** سلة التسجيل — جدول مضغوط بصف واحد لكل صنف */
export function StaffSentOrderRow({
  order,
  isSale,
  lang,
  t,
  onResend,
  onEdit,
  onDelete,
}: {
  order: any;
  isSale: boolean;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
  onResend?: (o: any) => void;
  onEdit: (o: any) => void;
  onDelete: (o: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const items = order.items || [];
  const dateLabel = order.saleDate ? formatSaudiDate(order.saleDate) : formatSaudiDate(order.createdAt);
  const title = isSale ? dateLabel : (order.sectionName || '—');
  const subtitle = isSale ? null : dateLabel;

  return (
    <div className="rounded-lg border border-noorix-border bg-noorix-bg overflow-hidden">
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start gap-2 min-w-0">
          <button
            type="button"
            className="shrink-0 mt-0.5 w-8 h-8 rounded-lg border border-noorix-border bg-noorix-bg-muted/50 flex items-center justify-center text-noorix-muted hover:text-noorix-text"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t('staffSentCollapse') : t('staffSentExpand')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn('transition-transform duration-200', open && 'rotate-180')}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="flex-1 min-w-0 text-start flex flex-col gap-0.5"
            onClick={() => setOpen((v) => !v)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[14px] text-noorix-text">{title}</span>
              <StatusBadge status={order.status} />
            </div>
            {subtitle ? (
              <span className="text-[11px] text-noorix-muted">{subtitle}</span>
            ) : null}
            {!open && items.length > 0 ? (
              <span className="text-[11px] text-noorix-muted">
                {items.length} {t('staffOrderItemsCount')}
              </span>
            ) : null}
          </button>
        </div>
        <div className="flex flex-wrap gap-1 justify-end ps-10">
          {isSale && onResend ? (
            <Button size="sm" variant="ghost" onClick={() => onResend(order)}>
              {t('staffSaleResend')}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => onEdit(order)}>{t('edit')}</Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(order)}>{t('delete')}</Button>
        </div>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-noorix-border flex flex-col gap-2">
          <div className="flex flex-col gap-2 pt-2">
            {items.map((it: any, i: number) => {
              const p = it.product;
              const nameAr = p?.nameAr || '—';
              const nameEn = p?.nameEn?.trim() || null;
              return (
                <div key={i} className="flex items-start justify-between gap-2 text-[13px]">
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <span className="font-medium text-noorix-text break-words">{nameAr}</span>
                    {nameEn ? (
                      <span className="text-[11px] text-noorix-muted break-words ltr text-start">{nameEn}</span>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-end flex flex-col gap-0.5 items-end">
                    {it.size || it.packaging ? (
                      <span className="text-[10px] text-noorix-muted ltr">
                        {formatVariantLabel(it.size, it.packaging, it.unit)}
                      </span>
                    ) : it.unit ? (
                      <span className="text-[10px] text-noorix-muted capitalize">{it.unit}</span>
                    ) : null}
                    <span className="font-semibold nx-font-numbers ltr">
                      {fmt(it.quantity, 0)}
                      <StaffItemPriceSuffix it={it} product={p} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {order.notes ? (
            <div className="text-[11px] text-noorix-muted italic break-words">{order.notes}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function StaffSentSaleGroup({
  orders,
  lang,
  t,
  onResend,
  onEdit,
  onDelete,
}: {
  orders: any[];
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
  onResend: (o: any) => void;
  onEdit: (o: any) => void;
  onDelete: (o: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const primary = orders[0];
  const logRef = primary?.logRef as string | null | undefined;
  const dateLabel = primary?.saleDate ? formatSaudiDate(primary.saleDate) : formatSaudiDate(primary.createdAt);
  const totalItems = orders.reduce((n, o) => n + ((o.items || []).length), 0);
  const sectionsCount = orders.length;
  const totalAmount = staffOrdersTotal(orders);
  const totalQty = staffOrdersQty(orders);
  const avgPerOrder = staffSaleAvgPerOrder(totalAmount, totalQty);

  return (
    <article className="p-3 sm:p-4 flex flex-col gap-2 overflow-x-auto">
      <div className="flex items-start gap-2 min-w-0">
        <button
          type="button"
          className="shrink-0 w-9 h-9 rounded-lg border border-noorix-border flex items-center justify-center text-noorix-muted hover:text-noorix-text hover:border-noorix-blue/40"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t('staffSentCollapse') : t('staffSentExpand')}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('transition-transform duration-200', open && 'rotate-180')}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="font-bold text-[15px] text-noorix-blue ltr leading-tight">{logRef || dateLabel}</span>
              <StatusBadge status={primary.status} />
              {sectionsCount > 1 ? (
                <Badge color="violet" size="sm">{t('staffSaleSectionsCount', sectionsCount)}</Badge>
              ) : null}
            </div>
            <Button size="sm" variant="ghost" className="shrink-0" onClick={() => onResend(primary)}>
              {t('staffSaleResend')}
            </Button>
          </div>
          <div className="text-[11px] text-noorix-muted flex flex-wrap items-center gap-x-1.5">
            {logRef ? <span>{dateLabel}</span> : null}
            {logRef ? <span aria-hidden>·</span> : null}
            <span>{totalItems} {t('staffOrderItemsCount')}</span>
          </div>
          <StaffSaleLogMetrics
            totalQty={totalQty}
            totalAmount={totalAmount}
            avgPerOrder={avgPerOrder}
            t={t}
          />
        </div>
      </div>

      {open ? orders.map((order, orderIdx) => (
        <div
          key={order.id}
          className={cn(
            'flex flex-col gap-2 border-t border-noorix-border pt-3',
            orderIdx > 0 && 'mt-1',
          )}
        >
          {sectionsCount > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] font-bold text-noorix-text">{order.sectionName || '—'}</span>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => onEdit(order)}>{t('edit')}</Button>
                <Button size="sm" variant="danger" onClick={() => onDelete(order)}>{t('delete')}</Button>
              </div>
            </div>
          ) : null}
          <StaffSaleItemsTable items={order.items || []} lang={lang} t={t} />
          {sectionsCount === 1 ? (
            <div className="flex flex-wrap gap-1 justify-end">
              <Button size="sm" variant="ghost" onClick={() => onEdit(order)}>{t('edit')}</Button>
              <Button size="sm" variant="danger" onClick={() => onDelete(order)}>{t('delete')}</Button>
            </div>
          ) : null}
          {order.notes ? (
            <p className="text-[11px] text-noorix-muted italic break-words m-0">{order.notes}</p>
          ) : null}
        </div>
      )) : null}
    </article>
  );
}

// ─── لوح طلبات (orders أو sales) ─────────────────────────────────────────────

