import React from 'react';
import { fmt } from '../../utils/format';
import { Button, Input, Modal } from '../../ui';
import type { OrderProduct, StaffCancellationReason } from '../../types/api';
import {
  STAFF_CANCELLATION_REASONS,
  STAFF_CANCELLATION_REASON_LABEL_KEYS,
} from './constants/staffCancellationReasons';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

export type StaffQtyModalState = {
  product: OrderProduct;
  qty: number;
  unit: string;
  cancellationReasons: StaffCancellationReason[];
  cancellationNote: string;
};

export function StaffCancellationReasonButtons({
  reasons,
  note,
  t,
  onReasonsChange,
  onNoteChange,
}: {
  reasons: StaffCancellationReason[];
  note: string;
  t: TranslateFn;
  onReasonsChange: (reasons: StaffCancellationReason[]) => void;
  onNoteChange: (note: string) => void;
}) {
  const selected = new Set(reasons);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[13px] font-semibold text-noorix-text">{t('staffCancellationReasons')}</div>
      <div className="flex flex-wrap gap-2">
        {STAFF_CANCELLATION_REASONS.map((reason) => {
          const active = selected.has(reason);
          return (
            <Button
              key={reason}
              type="button"
              variant="raw"
              size="auto"
              aria-pressed={active}
              onClick={() => {
                onReasonsChange(
                  active
                    ? reasons.filter((value) => value !== reason)
                    : [...reasons, reason],
                );
              }}
              className={`min-h-9 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${
                active
                  ? 'border-noorix-red bg-noorix-red text-white'
                  : 'border-noorix-border bg-noorix-surface text-noorix-text hover:border-noorix-red/60'
              }`}
            >
              {t(STAFF_CANCELLATION_REASON_LABEL_KEYS[reason])}
            </Button>
          );
        })}
      </div>
      {selected.has('other') ? (
        <Input
          label={t('staffCancellationOtherNote')}
          value={note}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => onNoteChange(event.target.value)}
          required
        />
      ) : null}
    </div>
  );
}

export function StaffWhatsAppPromptModal({
  text,
  isSale,
  t,
  onClose,
  onConfirm,
}: {
  text: string | null;
  isSale: boolean;
  t: TranslateFn;
  onClose: () => void;
  onConfirm: (text: string) => void;
}) {
  if (!text) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={t(isSale ? 'staffSaleSendConfirmTitle' : 'staffOrderSendConfirmTitle')}
      size="sm"
    >
      <div className="flex flex-col gap-4 p-1">
        <p className="text-[13px] text-noorix-muted leading-relaxed m-0">
          {t(isSale ? 'staffSaleSendConfirmHint' : 'staffOrderSendConfirmHint')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="md" onClick={onClose}>
            {t('staffSaleSendConfirmNo')}
          </Button>
          <Button variant="success" size="md" onClick={() => onConfirm(text)}>
            {t('staffSaleSendConfirmYes')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function StaffQtyModal({
  qtyModal,
  lang,
  t,
  onChange,
  onClose,
  onConfirm,
  isCancellation = false,
}: {
  qtyModal: StaffQtyModalState | null;
  lang: string;
  t: TranslateFn;
  onChange: (next: StaffQtyModalState | null) => void;
  onClose: () => void;
  onConfirm: () => void;
  isCancellation?: boolean;
}) {
  if (!qtyModal) return null;
  const quantityStep = ['pack', 'carton'].includes(qtyModal.unit) ? 0.25 : 1;
  return (
    <Modal
      open
      onClose={onClose}
      title={lang === 'en'
        ? (qtyModal.product.nameEn || qtyModal.product.nameAr)
        : (qtyModal.product.nameAr || qtyModal.product.nameEn)}
      size="sm"
    >
      <div className="flex flex-col gap-5 p-1">
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-noorix-muted text-center">{t('quantity')}</div>
          <div className="flex items-center justify-center gap-4">
            <Button
              type="button"
              variant="raw"
              size="auto"
              onClick={() => onChange({ ...qtyModal, qty: Math.max(quantityStep, qtyModal.qty - quantityStep) })}
              className="w-10 h-10 rounded-full border-2 border-noorix-border text-[22px] flex items-center justify-center hover:border-noorix-blue hover:text-noorix-blue transition-colors"
            >−</Button>
            <Input
              type="number"
              min={quantityStep}
              step={quantityStep}
              containerClassName="contents"
              className="w-20 h-12 text-center text-[22px] font-bold border-2 border-noorix-border rounded-xl bg-noorix-bg text-noorix-text focus:outline-none focus:border-noorix-blue"
              value={qtyModal.qty}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({
                ...qtyModal,
                qty: Math.max(quantityStep, Number(e.target.value) || quantityStep),
              })}
            />
            <Button
              type="button"
              variant="raw"
              size="auto"
              onClick={() => onChange({ ...qtyModal, qty: qtyModal.qty + quantityStep })}
              className="w-10 h-10 rounded-full border-2 border-noorix-border text-[22px] flex items-center justify-center hover:border-noorix-blue hover:text-noorix-blue transition-colors"
            >+</Button>
          </div>
        </div>
        <Input type="select" label={t('ordersUnit')} value={qtyModal.unit}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange({ ...qtyModal, unit: e.target.value })}
        >
          <option value="piece">{t('ordersUnitPiece')}</option>
          <option value="kg">{t('ordersUnitKg')}</option>
          <option value="box">{t('ordersUnitBox')}</option>
          <option value="pack">{t('ordersUnitPack')}</option>
          <option value="half_pack">{t('ordersUnitHalfPack')}</option>
          <option value="carton">{t('ordersUnitCarton')}</option>
          <option value="dozen">{t('ordersUnitDozen')}</option>
        </Input>
        {isCancellation ? (
          <StaffCancellationReasonButtons
            reasons={qtyModal.cancellationReasons}
            note={qtyModal.cancellationNote}
            t={t}
            onReasonsChange={(cancellationReasons) => onChange({ ...qtyModal, cancellationReasons })}
            onNoteChange={(cancellationNote) => onChange({ ...qtyModal, cancellationNote })}
          />
        ) : null}
        {qtyModal.product?.lastPrice != null && Number(qtyModal.product.lastPrice) > 0 ? (
          <div className="text-center text-[12px] text-noorix-muted ltr">
            {t('unitPrice')}: {fmt(qtyModal.product.lastPrice)} <span className="nx-sar">SR</span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="ghost" size="md" onClick={onClose}>{t('cancel')}</Button>
          <Button
            variant={isCancellation ? 'danger' : 'success'}
            size="md"
            onClick={onConfirm}
            disabled={isCancellation && (
              qtyModal.cancellationReasons.length === 0
              || (qtyModal.cancellationReasons.includes('other') && !qtyModal.cancellationNote.trim())
            )}
          >
            {t(isCancellation ? 'staffCancellationAddItem' : 'staffOrderAddItem')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
