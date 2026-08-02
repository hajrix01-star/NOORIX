import React from 'react';
import type { OrdersV4Item } from '../../../types/api';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, type SimpleTableColumn } from '../../../ui';
import { OrdersV4Select, OrdersV4Table as SimpleTable } from '../OrdersV4Shared';
import type { OrdersV4DocumentLineDraft } from './OrdersV4DocumentLineModal';
import { ordersV4CancellationReasonLabel } from './ordersV4CancellationReasons';

export type OrdersV4DocumentDraftLine = OrdersV4DocumentLineDraft & { key: string };

export function OrdersV4DocumentLinesTable({
  lines,
  items,
  isPurchase,
  isReceiving,
  isCancellation = false,
  onPatch,
  onRemove,
}: {
  lines: OrdersV4DocumentDraftLine[];
  items: OrdersV4Item[];
  isPurchase: boolean;
  isReceiving: boolean;
  isCancellation?: boolean;
  onPatch: (key: string, patch: Partial<OrdersV4DocumentDraftLine>) => void;
  onRemove: (key: string) => void;
}) {
  const { t } = useTranslation();
  const itemById = new Map(items.map((item) => [item.id, item]));
  const columns: SimpleTableColumn<OrdersV4DocumentDraftLine>[] = [
    {
      key: 'itemId',
      label: 'الصنف',
      minWidth: 180,
      render: (_value, line, index) => {
        const item = itemById.get(line.itemId);
        return (
          <div className="text-start leading-tight">
            <div className="font-semibold text-noorix-text">{item?.nameAr || '—'}</div>
            <div className="mt-1 text-[10px] text-noorix-muted">سطر {index + 1}</div>
          </div>
        );
      },
    },
    {
      key: 'quantity',
      label: 'الكمية',
      width: 110,
      render: (_value, line) => {
        const itemName = itemById.get(line.itemId)?.nameAr || '';
        return <Input aria-label={`كمية ${itemName}`} className="min-w-[80px]" type="number" min="0.000001" step="any" value={line.quantity} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onPatch(line.key, { quantity: event.target.value })} />;
      },
    },
    {
      key: 'unitId',
      label: 'وحدة الإدخال',
      minWidth: 130,
      render: (_value, line) => {
        const item = itemById.get(line.itemId);
        return <OrdersV4Select aria-label={`وحدة إدخال ${item?.nameAr || ''}`} className="min-w-[120px]" value={line.unitId} onChange={(event) => onPatch(line.key, { unitId: event.target.value })}>{(item?.units ?? []).filter((row) => row.isActive).map((row) => <option key={row.unitId} value={row.unitId}>{row.unit.nameAr}</option>)}</OrdersV4Select>;
      },
    },
    {
      key: 'unitPrice',
      label: 'سعر الوحدة',
      width: 120,
      render: (_value, line) => {
        const itemName = itemById.get(line.itemId)?.nameAr || '';
        return <Input aria-label={`سعر وحدة ${itemName}`} className="min-w-[90px]" type="number" min="0" step="any" value={line.unitPrice} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onPatch(line.key, { unitPrice: event.target.value })} />;
      },
    },
    {
      key: 'priceUnitId',
      label: 'وحدة السعر',
      minWidth: 130,
      render: (_value, line) => {
        const item = itemById.get(line.itemId);
        return (
          <OrdersV4Select
            aria-label={`وحدة سعر ${item?.nameAr || ''}`}
            className="min-w-[120px]"
            value={line.priceUnitId}
            onChange={(event) => {
              const priceUnit = item?.units.find((row) => row.unitId === event.target.value);
              onPatch(line.key, { priceUnitId: event.target.value, unitPrice: String(priceUnit?.lastPrice ?? line.unitPrice) });
            }}
          >
            {(item?.units ?? []).filter((row) => row.isActive && (!isPurchase || isReceiving || (row.isOrderEnabled && row.lastPrice != null))).map((row) => <option key={row.unitId} value={row.unitId}>{row.unit.nameAr}</option>)}
          </OrdersV4Select>
        );
      },
    },
    {
      key: 'actions',
      label: 'الإجراء',
      width: 76,
      render: (_value, line) => {
        const itemName = itemById.get(line.itemId)?.nameAr || '';
        return <Button aria-label={`حذف ${itemName}`} variant="danger" size="sm" onClick={() => onRemove(line.key)}>حذف</Button>;
      },
    },
  ];

  const visibleColumns = isCancellation
    ? [
      ...columns.filter((column) => !['unitPrice', 'priceUnitId', 'actions'].includes(String(column.key))),
      {
        key: 'cancellationReasons',
        label: t('ordersV4CancellationReasonsPlural'),
        minWidth: 240,
        render: (_value: unknown, line: OrdersV4DocumentDraftLine) => <div className="flex flex-wrap justify-center gap-1">{(line.cancellationReasons ?? []).map((reason) => <span key={reason} className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">{ordersV4CancellationReasonLabel(reason, t)}</span>)}</div>,
      } as SimpleTableColumn<OrdersV4DocumentDraftLine>,
      columns.find((column) => column.key === 'actions')!,
    ]
    : columns;

  return (
    <SimpleTable
      columns={visibleColumns}
      data={lines}
      tableMinWidth={isCancellation ? 720 : 860}
      emptyMessage="اضغط زر الصنف لإضافته إلى الطلب."
    />
  );
}
