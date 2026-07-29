import React from 'react';
import { Button, Input, TransactionDatePicker } from '../../../ui';
import type { OrderType } from '../../../types/api';

type Translation = (key: string) => string;

export function OrderBasicFields({
  orderDate,
  orderType,
  pettyCashAmount,
  t,
  onOrderDateChange,
  onOrderTypeChange,
  onPettyCashAmountChange,
}: {
  orderDate: string;
  orderType: OrderType;
  pettyCashAmount: string;
  t: Translation;
  onOrderDateChange: (value: string) => void;
  onOrderTypeChange: (value: OrderType) => void;
  onPettyCashAmountChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-xl bg-noorix-bg-muted/50 border border-noorix-border">
      <div className="flex flex-col gap-1 min-w-[130px] flex-1">
        <label className="text-[11px] text-noorix-muted font-medium">{t('orderDate')} *</label>
        <TransactionDatePicker value={orderDate} onValueChange={onOrderDateChange} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-noorix-muted font-medium">{t('orderType')} *</label>
        <div className="inline-flex rounded-xl border border-noorix-border overflow-hidden text-[12px] h-[38px]">
          {(['external', 'internal'] as const).map((type) => (
            <Button
              variant="raw"
              key={type}
              type="button"
              onClick={() => onOrderTypeChange(type)}
              className={`px-4 font-semibold transition-colors
                ${orderType === type
                  ? 'bg-noorix-blue text-white'
                  : 'bg-noorix-surface text-noorix-muted hover:bg-noorix-bg-muted'}`}
            >
              {type === 'external' ? t('orderTypeExternal') : t('orderTypeInternal')}
            </Button>
          ))}
        </div>
      </div>

      {orderType === 'external' && (
        <div className="flex flex-col gap-1 min-w-[110px] flex-1">
          <label className="text-[11px] text-noorix-muted font-medium">{t('pettyCashAmount')}</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={pettyCashAmount}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => onPettyCashAmountChange(event.target.value)}
            placeholder="0.00"
          />
        </div>
      )}
    </div>
  );
}
