import React from 'react';
import { fmt } from '../../utils/format';
import { Button, Input, Modal } from '../../ui';
import type { OrderProduct } from '../../types/api';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

export function StaffWhatsAppPromptModal({
  text,
  t,
  onClose,
  onConfirm,
}: {
  text: string | null;
  t: TranslateFn;
  onClose: () => void;
  onConfirm: (text: string) => void;
}) {
  if (!text) return null;
  return (
    <Modal open onClose={onClose} title={t('staffSaleSendConfirmTitle')} size="sm">
      <div className="flex flex-col gap-4 p-1">
        <p className="text-[13px] text-noorix-muted leading-relaxed m-0">
          {t('staffSaleSendConfirmHint')}
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
}: {
  qtyModal: { product: OrderProduct; qty: number; unit: string } | null;
  lang: string;
  t: TranslateFn;
  onChange: (next: { product: OrderProduct; qty: number; unit: string } | null) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!qtyModal) return null;
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
              onClick={() => onChange({ ...qtyModal, qty: Math.max(1, qtyModal.qty - 1) })}
              className="w-10 h-10 rounded-full border-2 border-noorix-border text-[22px] flex items-center justify-center hover:border-noorix-blue hover:text-noorix-blue transition-colors"
            >−</Button>
            <Input
              type="number"
              min="1"
              containerClassName="contents"
              className="w-20 h-12 text-center text-[22px] font-bold border-2 border-noorix-border rounded-xl bg-noorix-bg text-noorix-text focus:outline-none focus:border-noorix-blue"
              value={qtyModal.qty}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...qtyModal, qty: Math.max(1, Number(e.target.value) || 1) })}
            />
            <Button
              type="button"
              variant="raw"
              size="auto"
              onClick={() => onChange({ ...qtyModal, qty: qtyModal.qty + 1 })}
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
          <option value="dozen">{t('ordersUnitDozen')}</option>
        </Input>
        {qtyModal.product?.lastPrice != null && Number(qtyModal.product.lastPrice) > 0 ? (
          <div className="text-center text-[12px] text-noorix-muted ltr">
            {t('unitPrice')}: {fmt(qtyModal.product.lastPrice)} <span className="nx-sar">SR</span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="ghost" size="md" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="success" size="md" onClick={onConfirm}>{t('staffOrderAddItem')}</Button>
        </div>
      </div>
    </Modal>
  );
}
