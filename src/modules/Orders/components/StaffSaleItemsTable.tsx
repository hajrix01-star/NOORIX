import React from 'react';
import { SimpleTable } from '../../../ui';
import { fmt } from '../../../utils/format';
import {
  formatVariantLabel,
  resolveStaffItemUnitPrice,
  staffItemLineAmount,
} from '../utils/staffOrderBasketUtils';
import type { StaffOrderItem } from '../../../types/api';
import { STAFF_CANCELLATION_REASON_LABEL_KEYS } from '../constants/staffCancellationReasons';

export function StaffSaleItemsTable({
  items,
  lang,
  t,
}: {
  items: StaffOrderItem[];
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
}) {
  if (!items?.length) return null;
  return (
    <SimpleTable
      data={items}
      tableMinWidth={280}
      getRowClassName={() => 'hover:bg-noorix-bg-muted/30'}
      columns={[
        {
          key: 'product',
          label: t('product'),
          align: 'start',
          render: (_: unknown, it: StaffOrderItem) => {
            const p = it.product;
            const name = lang === 'en' ? (p?.nameEn || p?.nameAr || '—') : (p?.nameAr || p?.nameEn || '—');
            const variant = formatVariantLabel(it.size, it.packaging, it.unit);
            return (
              <div className="max-w-[140px] text-start sm:max-w-none">
                <div className="font-medium text-noorix-text break-words leading-snug">{name}</div>
                {variant ? (
                  <div className="text-[11px] text-noorix-muted ltr mt-0.5 truncate" title={variant}>{variant}</div>
                ) : null}
                {it.cancellationReasons?.length ? (
                  <div className="mt-1 text-[10px] leading-snug text-noorix-red">
                    {it.cancellationReasons
                      .map((reason) => t(STAFF_CANCELLATION_REASON_LABEL_KEYS[reason]))
                      .join('، ')}
                    {it.notes ? ` — ${it.notes}` : ''}
                  </div>
                ) : null}
              </div>
            );
          },
        },
        {
          key: 'quantity',
          label: t('quantity'),
          numeric: true,
          width: '3.5rem',
          render: (_value: unknown, item: StaffOrderItem) => <span className="font-semibold">{fmt(item.quantity, 0)}</span>,
        },
        {
          key: 'unitPrice',
          label: t('unitPrice'),
          numeric: true,
          width: '4rem',
          render: (_: unknown, it: StaffOrderItem) => {
            const p = it.product;
            const amountItem = { ...it, product: p };
            const unitPrice = resolveStaffItemUnitPrice(amountItem);
            return unitPrice.gt(0) ? (
              <>{fmt(unitPrice.toNumber())} <span className="nx-sar">SR</span></>
            ) : (
              <span className="text-noorix-muted">—</span>
            );
          },
        },
        {
          key: 'lineAmount',
          label: t('staffSaleGrandTotal'),
          numeric: true,
          width: '4.5rem',
          cellClassName: 'font-bold text-noorix-green',
          render: (_: unknown, it: StaffOrderItem) => {
            const p = it.product;
            const amountItem = { ...it, product: p };
            const lineAmt = staffItemLineAmount(amountItem);
            return !lineAmt.isZero() ? (
              <>{fmt(lineAmt.toNumber())} <span className="nx-sar">SR</span></>
            ) : (
              <span className="text-noorix-muted">—</span>
            );
          },
        },
      ]}
    />
  );
}
