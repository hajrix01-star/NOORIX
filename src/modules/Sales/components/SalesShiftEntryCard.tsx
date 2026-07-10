/**
 * بطاقة إدخال ملخص لشفت واحد (ضمن الإدخال الديناميكي)
 */
import React, { useMemo } from 'react';
import Decimal from 'decimal.js';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { splitTaxFromTotal, sumObjectValues } from '@noorix/finance-core';
import { Button, Input, Card, SummaryBar, type SummaryBarItem } from '../../../ui';
import type { SalesShiftValue } from '../constants/salesShift';
import type { ShiftEntryFormState } from '../constants/salesShiftEntry';
import { shiftEntryTitleKey } from '../constants/salesShiftEntry';
import { formatSalesApiAmount } from '../utils/salesApiPayload';
import type { SalesInputVaultRef } from '../../../types/api/domains/sales';

type Props = {
  shift: SalesShiftValue;
  form: ShiftEntryFormState;
  onChange: (next: ShiftEntryFormState) => void;
  salesChannels: SalesInputVaultRef[];
  salesChannelsLoading?: boolean;
  salesChannelsError?: string;
  lang: string;
  vatEnabled?: boolean;
  vatRate?: number;
  t: (key: string) => string;
  onCopyFromMorning?: () => void;
  showCopyFromMorning?: boolean;
};

export function SalesShiftEntryCard({
  shift,
  form,
  onChange,
  salesChannels,
  salesChannelsLoading = false,
  salesChannelsError = '',
  lang,
  vatEnabled = false,
  vatRate = 0.15,
  t,
  onCopyFromMorning,
  showCopyFromMorning = false,
}: Props) {
  const totalAmount = useMemo(() => sumObjectValues(form.channelAmounts), [form.channelAmounts]);
  const cc = parseInt(form.customerCount, 10) || 0;
  const avgPerCustomer = useMemo(() => {
    if (cc <= 0 || totalAmount.lte(0)) return new Decimal(0);
    return totalAmount.div(cc);
  }, [totalAmount, cc]);
  const { net: totalNet, tax: totalTax } = useMemo(
    () => splitTaxFromTotal(totalAmount, vatEnabled, vatRate),
    [totalAmount, vatEnabled, vatRate],
  );

  const patch = (partial: Partial<ShiftEntryFormState>) => onChange({ ...form, ...partial });

  const shiftEmoji = shift === 'morning' ? '🌅' : shift === 'evening' ? '🌙' : '☀️';
  const summaryItems: SummaryBarItem[] = [
    { key: 'total', label: t('totalLabel'), value: totalAmount.toNumber(), tone: 'green', currency: 'SR' },
    ...(vatEnabled && totalAmount.gt(0)
      ? [
          { key: 'net', label: t('net'), value: totalNet.toNumber(), tone: 'blue' as const, currency: 'SR' },
          { key: 'tax', label: t('tax'), value: totalTax.toNumber(), tone: 'amber' as const, currency: 'SR' },
        ]
      : []),
    { key: 'customers', label: t('customersLabel'), value: form.customerCount || 0, tone: 'blue' },
    { key: 'average', label: t('avgPerOrder'), value: avgPerCustomer.toNumber(), currency: 'SR' },
  ];

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-[14px] font-bold text-noorix-text">
          {shiftEmoji} {t(shiftEntryTitleKey(shift))}
        </h3>
        {showCopyFromMorning && onCopyFromMorning ? (
          <Button size="sm" variant="ghost" type="button" onClick={onCopyFromMorning}>
            {t('salesEntryCopyFromMorning')}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Input
          type="number"
          min="0"
          label={t('customerCount')}
          required
          value={form.customerCount}
          onChange={(e: { target: { value: string } }) => patch({ customerCount: e.target.value })}
          placeholder="0"
        />
        <Input
          type="number"
          min="0"
          step="0.01"
          label={t('cashOnHand')}
          value={form.cashOnHand}
          onChange={(e: { target: { value: string } }) => patch({ cashOnHand: e.target.value })}
          placeholder="0.00"
        />
      </div>

      <div>
        <label className="text-[13px] font-bold mb-2 block">{t('salesChannels')}</label>
        {salesChannelsLoading ? (
          <div className="p-4 text-center text-noorix-muted text-[13px] rounded-[10px] border-2 border-dashed border-noorix-border">
            {t('loading')}
          </div>
        ) : salesChannelsError ? (
          <div className="p-4 text-center text-[13px] font-semibold rounded-[10px] text-noorix-red bg-noorix-bg-muted border border-noorix-border">
            {salesChannelsError}
          </div>
        ) : salesChannels.length === 0 ? (
          <div className="p-4 text-center text-noorix-muted text-[13px] rounded-[10px] border-2 border-dashed border-noorix-border">
            {t('noSalesChannels')}
          </div>
        ) : (
          <div className="sales-channels-grid grid gap-2 sm:grid-cols-2">
            {salesChannels.map((v) => {
              const amt = form.channelAmounts[v.id] || '';
              return (
                <div key={v.id} className="flex flex-col gap-1">
                  <label
                    className="text-[12px] font-semibold text-noorix-muted truncate"
                    title={vaultDisplayName(v, lang)}
                  >
                    {vaultDisplayName(v, lang)}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amt}
                    onChange={(e: { target: { value: string } }) =>
                      patch({
                        channelAmounts: { ...form.channelAmounts, [v.id]: e.target.value },
                      })
                    }
                    placeholder="0.00"
                    className="nx-font-numbers"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Input
        multiline
        label={t('notes')}
        value={form.notes}
        onChange={(e: { target: { value: string } }) => patch({ notes: e.target.value })}
        rows={2}
        placeholder={t('notesPlaceholder')}
      />

      <SummaryBar items={summaryItems} />
    </Card>
  );
}

/** هل بطاقة الشفت جاهزة للحفظ؟ */
export function isShiftEntryFormValid(
  form: ShiftEntryFormState,
  salesChannels: SalesInputVaultRef[],
): boolean {
  const cc = parseInt(form.customerCount, 10) || 0;
  if (cc <= 0) return false;
  const channels = salesChannels
    .filter((v) => parseFloat(form.channelAmounts[v.id] || '') > 0)
    .map((v) => ({ vaultId: v.id, amount: form.channelAmounts[v.id] }));
  return channels.length > 0;
}

export function buildShiftEntryPayload(
  shift: SalesShiftValue,
  form: ShiftEntryFormState,
  salesChannels: SalesInputVaultRef[],
) {
  const channels = salesChannels
    .map((v) => ({
      vaultId: v.id,
      amount: formatSalesApiAmount(form.channelAmounts[v.id] || ''),
    }))
    .filter((ch) => ch.amount);
  return {
    shift,
    customerCount: parseInt(form.customerCount, 10) || 0,
    cashOnHand: formatSalesApiAmount(form.cashOnHand || '0') || '0',
    channels,
    notes: form.notes.trim() || undefined,
  };
}
