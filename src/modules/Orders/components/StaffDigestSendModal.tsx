import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { getSaudiToday } from '../../../utils/saudiDate';
import { Button, Input, Modal } from '../../../ui';

type StaffDigestSendModalProps = {
  open: boolean;
  onClose: () => void;
  estimatedTotal: number;
  pendingCount: number;
  busy: boolean;
  onConfirm: (opts: {
    orderType: 'external' | 'internal';
    pettyCashAmount?: string;
    orderDate: string;
  }) => void;
};

export function StaffDigestSendModal({
  open,
  onClose,
  estimatedTotal,
  pendingCount,
  busy,
  onConfirm,
}: StaffDigestSendModalProps) {
  const { t } = useTranslation();
  const [orderType, setOrderType] = useState<'external' | 'internal'>('external');
  const [pettyCashAmount, setPettyCashAmount] = useState('');
  const [orderDate, setOrderDate] = useState(() => getSaudiToday());

  return (
    <Modal open={open} onClose={onClose} title={t('staffDigestSendConfirmTitle')} size="sm">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[13px] text-noorix-muted leading-relaxed">
          {t('staffDigestSendConfirmHint', pendingCount)}
        </p>
        <div className="rounded-lg bg-noorix-bg-muted/50 border border-noorix-border px-3 py-2.5 flex justify-between items-center">
          <span className="text-[12px] text-noorix-muted">{t('staffDigestEstimatedTotal')}</span>
          <span className="text-[15px] font-bold nx-font-numbers ltr">{fmt(estimatedTotal)} <span className="nx-sar">SR</span></span>
        </div>
        <Input type="date" label={t('orderDate')} value={orderDate} onChange={(e: any) => setOrderDate(e.target.value)} />
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-noorix-text">{t('orderType')}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={orderType === 'external' ? 'primary' : 'ghost'}
              onClick={() => setOrderType('external')}
            >
              {t('orderTypeExternal')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={orderType === 'internal' ? 'primary' : 'ghost'}
              onClick={() => setOrderType('internal')}
            >
              {t('orderTypeInternal')}
            </Button>
          </div>
        </div>
        {orderType === 'external' && (
          <Input
            type="number"
            label={t('ordersPettyCashGiven')}
            value={pettyCashAmount}
            onChange={(e: any) => setPettyCashAmount(e.target.value)}
            placeholder={t('optional')}
          />
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" size="md" className="flex-1" onClick={onClose} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button
            variant="success"
            size="md"
            className="flex-1"
            disabled={busy}
            onClick={() => onConfirm({
              orderType,
              orderDate,
              pettyCashAmount: orderType === 'external' && pettyCashAmount.trim()
                ? pettyCashAmount.trim()
                : undefined,
            })}
          >
            {busy ? t('saving') : t('staffDigestSendAll')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
