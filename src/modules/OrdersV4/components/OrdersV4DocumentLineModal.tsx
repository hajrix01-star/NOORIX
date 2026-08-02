import React, { useEffect, useMemo, useState } from 'react';
import type { OrdersV4Item } from '../../../types/api';
import { Button, DialogActions, Input, Modal } from '../../../ui';
import { OrdersV4Field, OrdersV4Select, v4Number } from '../OrdersV4Shared';

export type OrdersV4DocumentLineDraft = {
  itemId: string;
  quantity: string;
  unitId: string;
  unitPrice: string;
  priceUnitId: string;
};

export function OrdersV4DocumentLineModal({
  item,
  isPurchase,
  isReceiving,
  onClose,
  onConfirm,
}: {
  item: OrdersV4Item | null;
  isPurchase: boolean;
  isReceiving: boolean;
  onClose: () => void;
  onConfirm: (draft: OrdersV4DocumentLineDraft) => void;
}) {
  const selectableUnits = useMemo(() => (item?.units ?? []).filter((row) => row.isActive
    && (!isPurchase || isReceiving || (row.isOrderEnabled && row.lastPrice != null))), [isPurchase, isReceiving, item]);
  const [unitId, setUnitId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');

  useEffect(() => {
    if (!item) return;
    const preferred = selectableUnits.find((row) => row.isOrderEnabled && row.lastPrice != null)
      ?? selectableUnits[0];
    setUnitId(preferred?.unitId ?? item.inventoryUnitId);
    setUnitPrice(String(preferred?.lastPrice ?? '0'));
    setQuantity('1');
  }, [item, selectableUnits]);

  if (!item) return null;
  const activeItem = item;
  const unitStep = 1;
  const numericQuantity = Math.max(unitStep, Number(quantity) || unitStep);

  function changeUnit(nextUnitId: string) {
    const nextUnit = selectableUnits.find((row) => row.unitId === nextUnitId);
    setUnitId(nextUnitId);
    setUnitPrice(String(nextUnit?.lastPrice ?? '0'));
  }

  function confirm() {
    if (!unitId || Number(quantity) <= 0) return;
    onConfirm({ itemId: activeItem.id, quantity, unitId, unitPrice: unitPrice || '0', priceUnitId: unitId });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={activeItem.nameAr}
      footer={<DialogActions actions={[
        { key: 'cancel', label: 'إلغاء', role: 'cancel', onClick: onClose },
        { key: 'add', label: 'إضافة', role: 'save', onClick: confirm, disabled: !unitId || Number(quantity) <= 0 },
      ]} />}
    >
      <div className="flex flex-col gap-5">
        <OrdersV4Field label="التغليف والوحدة">
          <OrdersV4Select value={unitId} onChange={(event) => changeUnit(event.target.value)}>
            {selectableUnits.map((row) => (
              <option key={row.unitId} value={row.unitId}>
                {row.purchaseLabel || row.unit.nameAr}{row.lastPrice != null ? ` - ${v4Number(row.lastPrice)} ر.س` : ''}
              </option>
            ))}
          </OrdersV4Select>
        </OrdersV4Field>

        <div className="flex flex-col gap-2">
          <span className="text-center text-[12px] text-noorix-muted">الكمية</span>
          <div className="flex items-center justify-center gap-4">
            <Button
              type="button"
              variant="raw"
              onClick={() => setQuantity(String(Math.max(unitStep, numericQuantity - unitStep)))}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-noorix-border text-[22px] hover:border-noorix-blue hover:text-noorix-blue"
            >
              −
            </Button>
            <Input
              type="number"
              min="0.000001"
              step="any"
              containerClassName="contents"
              value={quantity}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuantity(event.target.value)}
              className="h-12 w-20 text-center text-[20px] font-extrabold"
            />
            <Button
              type="button"
              variant="raw"
              onClick={() => setQuantity(String(numericQuantity + unitStep))}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-noorix-border text-[22px] hover:border-noorix-blue hover:text-noorix-blue"
            >
              +
            </Button>
          </div>
        </div>

        {isPurchase ? (
          <OrdersV4Field label="سعر الوحدة (ر.س)">
            <Input type="number" min="0" step="any" value={unitPrice} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setUnitPrice(event.target.value)} />
          </OrdersV4Field>
        ) : Number(unitPrice) > 0 ? (
          <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-3 text-center text-[12px] text-noorix-muted">
            السعر المعتمد: <b className="text-noorix-text">{v4Number(unitPrice)} ر.س</b>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
