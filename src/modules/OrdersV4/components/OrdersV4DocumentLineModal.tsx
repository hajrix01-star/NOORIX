import React, { useEffect, useMemo, useState } from 'react';
import type { OrdersV4CancellationReason, OrdersV4Item } from '../../../types/api';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, DialogActions, Input, Modal } from '../../../ui';
import { OrdersV4Field, OrdersV4Select, v4Number } from '../OrdersV4Shared';
import { ordersV4LocalizedName } from '../ordersV4Localization';
import { ORDERS_V4_CANCELLATION_REASON_OPTIONS } from './ordersV4CancellationReasons';

export type OrdersV4DocumentLineDraft = {
  itemId: string;
  quantity: string;
  unitId: string;
  unitPrice: string;
  priceUnitId: string;
  cancellationReasons?: OrdersV4CancellationReason[];
  cancellationNote?: string;
};

export function OrdersV4DocumentLineModal({
  item,
  isPurchase,
  isReceiving,
  isCancellation = false,
  onClose,
  onConfirm,
}: {
  item: OrdersV4Item | null;
  isPurchase: boolean;
  isReceiving: boolean;
  isCancellation?: boolean;
  onClose: () => void;
  onConfirm: (draft: OrdersV4DocumentLineDraft) => void;
}) {
  const { t, lang } = useTranslation();
  const selectableUnits = useMemo(() => (item?.units ?? []).filter((row) => row.isActive
    && (!isPurchase || isReceiving || (row.isOrderEnabled && row.lastPrice != null))), [isPurchase, isReceiving, item]);
  const [unitId, setUnitId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [cancellationReasons, setCancellationReasons] = useState<OrdersV4CancellationReason[]>([]);
  const [cancellationNote, setCancellationNote] = useState('');

  useEffect(() => {
    if (!item) return;
    const preferred = selectableUnits.find((row) => row.isOrderEnabled && row.lastPrice != null)
      ?? selectableUnits[0];
    setUnitId(preferred?.unitId ?? item.inventoryUnitId);
    setUnitPrice(String(preferred?.lastPrice ?? '0'));
    setQuantity('1');
    setCancellationReasons([]);
    setCancellationNote('');
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
    if (isCancellation && (!cancellationReasons.length || (cancellationReasons.includes('other') && !cancellationNote.trim()))) return;
    onConfirm({
      itemId: activeItem.id,
      quantity,
      unitId,
      unitPrice: unitPrice || '0',
      priceUnitId: unitId,
      cancellationReasons: isCancellation ? cancellationReasons : undefined,
      cancellationNote: isCancellation ? cancellationNote.trim() : undefined,
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={ordersV4LocalizedName(activeItem, lang)}
      footer={<DialogActions actions={[
        { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: onClose },
        { key: 'add', label: isCancellation ? t('ordersV4CancellationAddLine') : t('add'), role: isCancellation ? 'danger' : 'save', onClick: confirm, disabled: !unitId || Number(quantity) <= 0 || (isCancellation && (!cancellationReasons.length || (cancellationReasons.includes('other') && !cancellationNote.trim()))) },
      ]} />}
    >
      <div className="flex flex-col gap-5">
        <OrdersV4Field label={t('ordersV4PackagingUnit')}>
          <OrdersV4Select value={unitId} onChange={(event) => changeUnit(event.target.value)}>
            {selectableUnits.map((row) => (
              <option key={row.unitId} value={row.unitId}>
                {lang === 'en' ? ordersV4LocalizedName(row.unit, lang) : (row.purchaseLabel || ordersV4LocalizedName(row.unit, lang))}{row.lastPrice != null ? ` - ${v4Number(row.lastPrice)} ${lang === 'en' ? 'SR' : 'ر.س'}` : ''}
              </option>
            ))}
          </OrdersV4Select>
        </OrdersV4Field>

        <div className="flex flex-col gap-2">
          <span className="text-center text-[12px] text-noorix-muted">{t('ordersV4Quantity')}</span>
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

        {isCancellation && (
          <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/60 p-3">
            <div>
              <div className="text-[13px] font-bold text-red-900">{t('staffCancellationReasons')}</div>
              <div className="mt-1 text-[11px] text-red-700">{t('ordersV4CancellationMultipleReasonsHint')}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={t('ordersV4CancellationReasonsPlural')}>
              {ORDERS_V4_CANCELLATION_REASON_OPTIONS.map((option) => {
                const selected = cancellationReasons.includes(option.value);
                return <Button
                  key={option.value}
                  type="button"
                  variant="raw"
                  aria-pressed={selected}
                  onClick={() => setCancellationReasons((current) => selected ? current.filter((reason) => reason !== option.value) : [...current, option.value])}
                  className={`min-h-10 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${selected ? 'border-red-600 bg-red-600 text-white shadow-sm' : 'border-red-200 bg-white text-noorix-text hover:border-red-400'}`}
                >{t(option.translationKey)}</Button>;
              })}
            </div>
            {cancellationReasons.includes('other') && <OrdersV4Field label={t('ordersV4CancellationOtherExplanation')}><Input multiline rows={2} value={cancellationNote} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setCancellationNote(event.target.value)} placeholder={t('ordersV4CancellationOtherPlaceholder')} /></OrdersV4Field>}
          </div>
        )}

        {isPurchase ? (
          <OrdersV4Field label={`${t('ordersV4UnitPrice')} (${lang === 'en' ? 'SR' : 'ر.س'})`}>
            <Input type="number" min="0" step="any" value={unitPrice} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setUnitPrice(event.target.value)} />
          </OrdersV4Field>
        ) : Number(unitPrice) > 0 ? (
          <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-3 text-center text-[12px] text-noorix-muted">
            {t('ordersV4ApprovedPrice')}: <b className="text-noorix-text">{v4Number(unitPrice)} {lang === 'en' ? 'SR' : 'ر.س'}</b>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
