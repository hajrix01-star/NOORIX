import React, { useEffect, useMemo, useState } from 'react';
import { sumObjectValues } from '@noorix/finance-core';
import { Button, AdaptiveSheet, DialogActions, TransactionDatePicker, Input, FmtNum } from '../../../ui';
import { toDateInputYmd } from '../../../utils/saudiDate';
import { useTranslation } from '../../../i18n/useTranslation';
import type { DailySalesEditBody, DailySalesTableRow } from '../hooks/useDailySalesScreen';
import type { ShiftEntryFormState } from '../constants/salesShiftEntry';
import { getSalesShiftLabel, resolveSalesSummaryShift } from '../constants/salesShift';
import { SalesShiftEntryCard, buildShiftEntryPayload, isShiftEntryFormValid } from './SalesShiftEntryCard';
import type { SalesInputVaultRef, SalesSummaryItem } from '../../../types/api/domains/sales';
import { compactBusinessIdentifier } from '../../../utils/compactDisplay';

type Props = {
  day: DailySalesTableRow;
  salesChannels: SalesInputVaultRef[];
  salesChannelsLoading?: boolean;
  salesChannelsError?: string;
  vatEnabled?: boolean;
  vatRate?: number;
  onSaved: (body: Array<{ id: string; body: DailySalesEditBody }>) => Promise<void>;
  onClose: () => void;
  onWhatsApp?: (day: DailySalesTableRow) => void;
  onDelete?: (day: DailySalesTableRow) => void;
  canDelete?: boolean;
};

function formFromSummary(summary: SalesSummaryItem): ShiftEntryFormState {
  return {
    customerCount: String(summary.customerCount ?? 0),
    cashOnHand: String(summary.cashOnHand ?? 0),
    notes: summary.notes || '',
    channelAmounts: (summary.channels || []).reduce((acc: Record<string, string>, ch) => {
      if (ch?.vaultId) acc[ch.vaultId] = String(ch.amount ?? 0);
      return acc;
    }, {}),
  };
}

export function SalesDayEditModal({
  day,
  salesChannels,
  salesChannelsLoading = false,
  salesChannelsError = '',
  vatEnabled = false,
  vatRate = 0.15,
  onSaved,
  onClose,
  onWhatsApp,
  onDelete,
  canDelete = false,
}: Props) {
  const { lang, t } = useTranslation();
  const [txDate, setTxDate] = useState('');
  const [forms, setForms] = useState<Record<string, ShiftEntryFormState>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const summaries = useMemo(() => day.summaries || [day], [day]);

  useEffect(() => {
    setTxDate(toDateInputYmd(day.transactionDate));
    setForms(Object.fromEntries(summaries.map((summary) => [summary.id, formFromSummary(summary)])));
  }, [day, summaries]);

  const valid = useMemo(() => {
    if (salesChannelsLoading || !!salesChannelsError || summaries.length === 0) return false;
    return summaries.every((summary) => {
      const form = forms[summary.id];
      return form ? isShiftEntryFormValid(form, salesChannels) : false;
    });
  }, [forms, salesChannels, salesChannelsError, salesChannelsLoading, summaries]);

  const dayTotal = useMemo(
    () => summaries.reduce((sum, summary) => sum.plus(sumObjectValues(forms[summary.id]?.channelAmounts)), sumObjectValues({})),
    [forms, summaries],
  );

  async function handleSave() {
    setError('');
    if (!valid) {
      setError('تأكد من إدخال العملاء وقناة بيع واحدة على الأقل لكل شفت في اليوم.');
      return;
    }
    setSaving(true);
    try {
      await onSaved(summaries.map((summary) => {
        const shift = resolveSalesSummaryShift(summary);
        return {
          id: summary.id,
          body: {
            transactionDate: txDate,
            ...buildShiftEntryPayload(shift, forms[summary.id], salesChannels),
          },
        };
      }));
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل التحديث');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={`تعديل يوم المبيعات — ${toDateInputYmd(day.transactionDate)}`}
      size="xl"
      side="start"
      footer={
        <DialogActions
          actions={[
            {
              key: 'cancel',
              label: 'إلغاء',
              role: 'cancel',
              onClick: onClose,
            },
            {
              key: 'whatsapp',
              label: t('printWhatsApp'),
              role: 'success',
              hidden: !onWhatsApp,
              disabled: saving,
              onClick: () => onWhatsApp?.(day),
            },
            {
              key: 'delete',
              label: t('delete'),
              role: 'delete',
              hidden: !canDelete || !onDelete,
              disabled: saving,
              onClick: () => {
                onClose();
                onDelete?.(day);
              },
            },
            {
              key: 'save-day',
              label: saving ? 'جاري الحفظ...' : 'حفظ اليوم كامل',
              role: 'save',
              disabled: saving || !valid,
              onClick: handleSave,
            },
          ]}
        />
      }
    >
      {error && (
        <div className="rounded-lg text-[13px] mb-4 p-2.5 text-noorix-red bg-noorix-red-10 border border-noorix-red-20">
          {error}
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3 items-end">
        <label className="flex flex-col gap-1 text-[13px] font-bold text-noorix-text">
          تاريخ العملية *
          <TransactionDatePicker
            value={txDate}
            onValueChange={setTxDate}
            className="nx-input"
          />
        </label>
        <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 px-3 py-2 text-[12px] text-noorix-muted">
          {summaries.length} شفت · الإجمالي الحالي: <span dir="ltr"><FmtNum n={dayTotal.toNumber()} /> SR</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        {summaries.map((summary) => {
          const shift = resolveSalesSummaryShift(summary);
          return (
            <div key={summary.id} className="flex min-w-0 flex-col gap-2">
              <div className="text-[12px] font-bold text-noorix-muted" title={String(summary.summaryNumber || '')}>
                #{compactBusinessIdentifier(summary.summaryNumber) || '—'} · {getSalesShiftLabel(shift, t)}
              </div>
              <SalesShiftEntryCard
                shift={shift}
                form={forms[summary.id] || formFromSummary(summary)}
                onChange={(next) => setForms((prev) => ({ ...prev, [summary.id]: next }))}
                salesChannels={salesChannels}
                salesChannelsLoading={salesChannelsLoading}
                salesChannelsError={salesChannelsError}
                lang={lang}
                vatEnabled={vatEnabled}
                vatRate={vatRate}
                t={t}
              />
            </div>
          );
        })}
      </div>
    </AdaptiveSheet>
  );
}
