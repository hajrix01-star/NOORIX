import React from 'react';
import { Badge, Button, FmtNum } from '../../../ui';
import type { SmartTableColumn } from '../../../ui';
import { formatSaudiDate } from '../../../utils/saudiDate';
import type { OrderRecord } from '../../../types/api';

type Translate = (key: string) => string;

type OrdersTablePartsInput = {
  t: Translate;
  cumulativeRemainingByOrderId: Map<string, number>;
  onView: (order: OrderRecord) => void;
};

export function buildOrdersColumns({
  t,
  cumulativeRemainingByOrderId,
  onView,
}: OrdersTablePartsInput): SmartTableColumn<OrderRecord>[] {
  return [
    {
      key: 'orderNumber',
      label: t('orderNumber'),
      minWidth: 100,
      align: 'center',
      shrink: true,
      render: (_value: unknown, row: OrderRecord) => (
        <Button
          variant="raw"
          size="auto"
          className="mx-auto !h-auto rounded-md px-2 py-1 text-center nx-cell-num nx-cell-num--blue whitespace-nowrap hover:bg-noorix-blue/10 focus-visible:ring-2 focus-visible:ring-noorix-blue"
          onClick={() => onView(row)}
        >
          {row.orderNumber}
        </Button>
      ),
    },
    {
      key: 'orderDate',
      label: t('orderDate'),
      minWidth: 115,
      align: 'center',
      render: (_value: unknown, row: OrderRecord) => (
        <span className="whitespace-nowrap">{formatSaudiDate(row.orderDate)}</span>
      ),
    },
    {
      key: 'orderType',
      label: t('orderType'),
      align: 'center',
      shrink: true,
      render: (_value: unknown, row: OrderRecord) => {
        const isExt = row.orderType === 'external';
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
      render: (_value: unknown, row: OrderRecord) => (row.items ?? []).length,
    },
    {
      key: 'pettyCashAmount',
      label: t('ordersPettyCashGiven'),
      align: 'center',
      shrink: true,
      render: (_value: unknown, order: OrderRecord) =>
        order.orderType === 'external' && order.pettyCashAmount != null ? (
          <span className="nx-cell-num nx-cell-num--blue whitespace-nowrap"><FmtNum n={order.pettyCashAmount} /> SR</span>
        ) : (
          <span className="nx-cell-muted">-</span>
        ),
    },
    {
      key: 'totalAmount',
      label: t('orderTotalAmount') || t('ordersDelegatePurchases'),
      numeric: true,
      align: 'center',
      shrink: true,
      render: (_value: unknown, row: OrderRecord) => (
        <span className="nx-cell-num font-bold whitespace-nowrap"><FmtNum n={row.totalAmount ?? 0} /> SR</span>
      ),
    },
    {
      key: 'id',
      label: t('ordersCumulativeRemaining'),
      align: 'center',
      shrink: true,
      render: (_value: unknown, order: OrderRecord) => {
        const cumRem = order.orderType === 'external' ? cumulativeRemainingByOrderId.get(order.id) : null;
        if (cumRem == null) return <span className="nx-cell-muted">-</span>;
        return (
          <Badge color={cumRem >= 0 ? 'green' : 'red'} size="sm">
            {cumRem >= 0 ? '' : '-'}
            <FmtNum n={Math.abs(cumRem)} /> SR
          </Badge>
        );
      },
    },
  ];
}

export function buildOrdersFooterCells(t: Translate, filteredTotal: number) {
  return (
    <>
      <td colSpan={5} className="font-bold text-center py-[11px] px-[14px]">
        {t('ordersFilteredTotal')}
      </td>
      <td className="nx-cell-num nx-cell-num--blue font-extrabold text-center text-[14px] py-[11px] px-[14px]">
        <FmtNum n={filteredTotal} /> SR
      </td>
      <td className="text-center py-[11px] px-[14px]" />
    </>
  );
}

export function renderOrdersMobileCard(
  order: OrderRecord,
  { t, cumulativeRemainingByOrderId, onView }: OrdersTablePartsInput,
) {
  const pettyGiven = order.orderType === 'external' ? Number(order.pettyCashAmount ?? 0) : null;
  const cumRem = order.orderType === 'external' ? cumulativeRemainingByOrderId.get(order.id) : null;
  const isExt = order.orderType === 'external';
  return (
    <div className="flex cursor-pointer flex-col gap-2" onClick={() => onView(order)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-bold text-noorix-blue nx-font-numbers">#{order.orderNumber}</span>
        <Badge color={isExt ? 'blue' : 'green'} size="sm">
          {isExt ? t('orderTypeExternal') : t('orderTypeInternal')}
        </Badge>
      </div>
      <div className="text-[12px] text-noorix-muted text-end">{formatSaudiDate(order.orderDate)}</div>
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-noorix-bg-muted py-2 px-2.5">
        <div className="flex min-w-0 flex-col items-center">
          <div className="text-[12px] text-noorix-muted mb-0.5 w-full text-center">{t('ordersTotalItems')}</div>
          <div className="text-[13px] font-semibold nx-font-numbers w-full text-center">{(order.items ?? []).length}</div>
        </div>
        <div className="flex min-w-0 flex-col items-center">
          <div className="text-[12px] text-noorix-muted mb-0.5 w-full text-center">{t('orderTotalAmount')}</div>
          <div dir="ltr" className="text-[13px] font-bold nx-font-numbers text-noorix-navy w-full text-center">
            <FmtNum n={Number(order.totalAmount ?? 0)} /> SR
          </div>
        </div>
        {pettyGiven != null && (
          <div className="flex min-w-0 flex-col items-center">
            <div className="text-[12px] text-noorix-muted mb-0.5 w-full text-center">{t('ordersPettyCashGiven')}</div>
            <div dir="ltr" className="text-[13px] nx-font-numbers text-noorix-blue w-full text-center">
              <FmtNum n={pettyGiven} /> SR
            </div>
          </div>
        )}
        {cumRem != null && (
          <div className="flex min-w-0 flex-col items-center">
            <div className="text-[12px] text-noorix-muted mb-0.5 w-full text-center">{t('ordersCumulativeRemaining')}</div>
            <div className="flex w-full justify-center">
              <Badge color={cumRem >= 0 ? 'green' : 'red'} size="sm">
                {cumRem >= 0 ? '' : '-'}
                <FmtNum n={Math.abs(cumRem)} /> SR
              </Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function renderOrdersCompactRow(
  order: OrderRecord,
  { t, cumulativeRemainingByOrderId, onView }: OrdersTablePartsInput,
) {
  const isExt = order.orderType === 'external';
  const total = Number(order.totalAmount ?? 0);
  const cumRem = cumulativeRemainingByOrderId?.get(order.id);
  return (
    <div className="cursor-pointer" onClick={() => onView(order)}>
      <div className="nx-cr__line1">
        <span className="nx-cr__id">#{order.orderNumber}</span>
        <Badge color={isExt ? 'blue' : 'green'} size="sm">
          {isExt ? t('orderTypeExternal') : t('orderTypeInternal')}
        </Badge>
        {cumRem != null && (
          <Badge color={cumRem >= 0 ? 'green' : 'red'} size="sm">
            {cumRem >= 0 ? '' : '-'}<FmtNum n={Math.abs(cumRem)} />
          </Badge>
        )}
      </div>
      <div className="nx-cr__line2">
        <div className="nx-cr__line2-start">
          <span className="nx-cr__meta">{formatSaudiDate(order.orderDate)}</span>
          <span className="nx-cr__meta">{(order.items ?? []).length} {t('ordersTotalItems')}</span>
        </div>
        <div className="nx-cr__line2-end">
          <span className="nx-cr__amount"><FmtNum n={total} /> <span className="nx-sar">SR</span></span>
        </div>
      </div>
    </div>
  );
}
