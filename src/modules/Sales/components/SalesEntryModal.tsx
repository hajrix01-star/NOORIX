/**
 * SalesEntryModal — إدخال ملخص المبيعات اليومي (ديناميكي: شفت واحد أو شفتان أو يوم كامل)
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Decimal from 'decimal.js';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { getSaudiToday, formatSaudiDate, formatSaudiWeekdayName } from '../../../utils/saudiDate';
import { sumObjectValues } from '@noorix/finance-core';
import { Button, Input, AdaptiveSheet, FmtNum } from '../../../ui';
import type { DailySalesChannelEntry } from './DailySalesChannelsChips';
import { SalesShiftPicker } from './SalesShiftPicker';
import { SalesShiftEntryCard, isShiftEntryFormValid, buildShiftEntryPayload } from './SalesShiftEntryCard';
import { SalesDualShiftEntryReport, buildDualShiftPreviewRows } from './SalesDualShiftEntryReport';
import type { SalesShiftValue } from '../constants/salesShift';
import { getSalesShiftLabel, parseSalesShiftValue, resolveSalesSummaryShift } from '../constants/salesShift';
import {
  EMPTY_SALES_ENTRY_SELECTION,
  emptyShiftEntryForm,
  getActiveEntryShifts,
  hasEntrySelection,
  type SalesEntrySelection,
  type ShiftEntryFormState,
} from '../constants/salesShiftEntry';
import {
  aggregateSalesDayByShift,
  buildDailyShiftWhatsAppText,
  buildDayShiftReportFromEntryItems,
  openWhatsAppWithText,
} from '../utils/salesDayShiftReport';
import { buildCreateSalesSummaryApiBody } from '../utils/salesApiPayload';
import { buildVaultLookup, channelsFromEntryPayload } from '../utils/salesWhatsAppChannels';
import { fetchMonthAppShare } from '../utils/fetchMonthAppShare';
import { useSalesEntryDateContext } from '../hooks/useSalesEntryDateContext';
import { compareYmd } from '../utils/suggestSalesEntryDate';
import { useQueryClient } from '@tanstack/react-query';
import { salesKeys } from '../../../services/queryKeys';

type SavedSummary = {
  id?: string;
  summaryNumber?: string | number;
  totalAmount?: string | number;
  customerCount?: number;
  shift?: string;
  transactionDate?: string;
  channels?: DailySalesChannelEntry[] | null;
};

type Props = {
  companyId: string;
  companyName?: string;
  salesChannels: { id: string; [key: string]: unknown }[];
  salesChannelsLoading?: boolean;
  salesChannelsError?: string;
  vatEnabled?: boolean;
  vatRate?: number;
  createSummary: { mutate: Function; isPending: boolean };
  createSummaryBatch?: { mutate: Function; isPending: boolean };
  onSuccess?: (summary: SavedSummary | SavedSummary[]) => void;
  onError?: (msg: string) => void;
  onClose?: () => void;
  onWhatsApp?: (summary: SavedSummary) => void;
  autoCloseOnSuccess?: boolean;
};

function ensureShiftForms(
  prev: Partial<Record<SalesShiftValue, ShiftEntryFormState>>,
  active: SalesShiftValue[],
): Partial<Record<SalesShiftValue, ShiftEntryFormState>> {
  const next = { ...prev };
  for (const s of active) {
    if (!next[s]) next[s] = emptyShiftEntryForm();
  }
  return next;
}

export function SalesEntryModal({
  companyId,
  companyName = '',
  salesChannels,
  salesChannelsLoading = false,
  salesChannelsError = '',
  vatEnabled = false,
  vatRate = 0.15,
  createSummary,
  createSummaryBatch,
  onSuccess,
  onError,
  onClose,
  onWhatsApp,
  autoCloseOnSuccess = true,
}: Props) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [txDate, setTxDate] = useState('');
  const [dateTouched, setDateTouched] = useState(false);
  const dateAutoAppliedRef = useRef(false);
  const [selection, setSelection] = useState<SalesEntrySelection>(EMPTY_SALES_ENTRY_SELECTION);
  const [shiftForms, setShiftForms] = useState<Partial<Record<SalesShiftValue, ShiftEntryFormState>>>({});
  const [savedSummaries, setSavedSummaries] = useState<SavedSummary[] | null>(null);
  const [savedEntryItems, setSavedEntryItems] = useState<{ shift: string }[] | null>(null);

  const activeShifts = useMemo(() => getActiveEntryShifts(selection), [selection]);
  const {
    lastEntryYmd,
    suggestedDate,
    gapDays,
    gapDaysTotalCount,
    duplicateShifts,
    contextLoading,
    daySummariesLoading,
  } = useSalesEntryDateContext(companyId, txDate || getSaudiToday(), activeShifts);
  const isBatch = activeShifts.length > 1;
  const saving = createSummary.isPending || (createSummaryBatch?.isPending ?? false);

  useEffect(() => {
    setDateTouched(false);
    dateAutoAppliedRef.current = false;
    setTxDate('');
    setSelection(EMPTY_SALES_ENTRY_SELECTION);
    setShiftForms({});
    setSavedSummaries(null);
  }, [companyId]);

  useEffect(() => {
    if (!suggestedDate || dateTouched || contextLoading) return;
    if (dateAutoAppliedRef.current && txDate) return;
    setTxDate(suggestedDate);
    dateAutoAppliedRef.current = true;
  }, [suggestedDate, dateTouched, contextLoading, txDate]);

  useEffect(() => {
    setShiftForms((prev) => ensureShiftForms(prev, activeShifts));
  }, [activeShifts]);

  const grandTotal = useMemo(() => {
    let total = new Decimal(0);
    let customers = 0;
    for (const s of activeShifts) {
      const f = shiftForms[s];
      if (!f) continue;
      total = total.plus(sumObjectValues(f.channelAmounts));
      customers += parseInt(f.customerCount, 10) || 0;
    }
    return { total, customers };
  }, [activeShifts, shiftForms]);

  const allFormsValid = useMemo(
    () => activeShifts.length > 0 && activeShifts.every((s) => {
      const f = shiftForms[s];
      return f && isShiftEntryFormValid(f, salesChannels);
    }),
    [activeShifts, shiftForms, salesChannels],
  );

  const resetForm = useCallback(async () => {
    setDateTouched(false);
    dateAutoAppliedRef.current = false;
    setTxDate('');
    setSelection(EMPTY_SALES_ENTRY_SELECTION);
    setShiftForms({});
    setSavedSummaries(null);
    setSavedEntryItems(null);
    await queryClient.refetchQueries({ queryKey: salesKeys.entryContextRoot() });
  }, [queryClient]);

  const enrichSummariesWithEntryChannels = useCallback((
    summaries: SavedSummary[],
    items: { shift: string; channels: { vaultId: string; amount: string }[] }[],
  ): SavedSummary[] => summaries.map((s, i) => {
    const payload = items[i];
    if (!payload?.channels?.length) return s;
    const hasChannels = Array.isArray(s.channels) && s.channels.length > 0;
    if (hasChannels) return s;
    return {
      ...s,
      shift: payload.shift ?? s.shift,
      channels: channelsFromEntryPayload(payload, salesChannels),
    };
  }), [salesChannels]);

  const vaultById = useMemo(() => buildVaultLookup(salesChannels), [salesChannels]);

  const openDailyWhatsApp = useCallback(async (
    summaries: SavedSummary[],
    entryItems?: { shift: string; channels?: { vaultId: string; amount: string }[] }[] | null,
  ) => {
    const enriched = entryItems?.length
      ? enrichSummariesWithEntryChannels(
        summaries,
        entryItems as { shift: string; channels: { vaultId: string; amount: string }[] }[],
      )
      : summaries;
    const report = entryItems?.length
      ? buildDayShiftReportFromEntryItems(enriched, entryItems)
      : aggregateSalesDayByShift(enriched, txDate);
    const dateRaw = formatSaudiDate(txDate);
    let dateLabel = dateRaw;
    if (dateRaw !== '—') {
      const wd = formatSaudiWeekdayName(txDate, lang);
      if (wd) dateLabel = `${dateRaw} ${wd}`;
    }
    const monthAppShare = await fetchMonthAppShare(companyId, txDate, vaultById);
    const text = buildDailyShiftWhatsAppText({
      companyName,
      dateLabel,
      report,
      t,
      daySummaries: enriched,
      dayYmd: txDate,
      lang,
      vaultById,
      monthAppShare,
    });
    openWhatsAppWithText(text);
  }, [companyId, companyName, enrichSummariesWithEntryChannels, lang, t, txDate, vaultById]);

  const dualShiftPreviewRows = useMemo(
    () => buildDualShiftPreviewRows(
      activeShifts,
      (shift) => sumObjectValues(shiftForms[shift]?.channelAmounts ?? {}).toNumber(),
      (shift) => parseInt(shiftForms[shift]?.customerCount ?? '', 10) || 0,
    ),
    [activeShifts, shiftForms],
  );

  const saveDisabled = saving
    || salesChannelsLoading
    || !!salesChannelsError
    || salesChannels.length === 0
    || !hasEntrySelection(selection)
    || !allFormsValid
    || !txDate
    || contextLoading
    || daySummariesLoading;

  const dateBannerText = useMemo(() => {
    const suggestedLabel = formatSaudiDate(suggestedDate);
    if (!lastEntryYmd) {
      return t('salesEntryDateBannerNone', suggestedLabel);
    }
    return t('salesEntryDateBannerLastSuggested', formatSaudiDate(lastEntryYmd), suggestedLabel);
  }, [lastEntryYmd, suggestedDate, t]);

  const showDateDiffersHint = !!txDate
    && !!suggestedDate
    && compareYmd(txDate, suggestedDate) !== 0;

  function formatGapDaysLabel(days: string[], totalCount: number): string {
    const formatted = days.slice(0, 5).map((d) => formatSaudiDate(d));
    const remaining = Math.max(0, totalCount - formatted.length);
    if (remaining > 0) {
      formatted.push(t('salesEntryGapDaysMore', String(remaining)));
    }
    return formatted.join(lang === 'ar' ? '، ' : ', ');
  }

  const duplicateShiftHint = duplicateShifts.length > 0
    ? t(
      'salesEntryDuplicateShiftHint',
      duplicateShifts.map((s) => getSalesShiftLabel(s, t)).join(lang === 'ar' ? '، ' : ', '),
      formatSaudiDate(txDate),
    )
    : '';

  const gapDaysHint = gapDaysTotalCount > 0
    ? t(
      'salesEntryGapDaysHint',
      formatGapDaysLabel(gapDays, gapDaysTotalCount),
      formatSaudiDate(txDate),
    )
    : '';

  function confirmSaveWarnings(): boolean {
    if (duplicateShifts.length > 0) {
      const shiftLabels = duplicateShifts.map((s) => getSalesShiftLabel(s, t)).join(lang === 'ar' ? '، ' : ', ');
      const msg = t('salesEntryDuplicateShiftConfirm', shiftLabels, formatSaudiDate(txDate));
      if (!window.confirm(msg)) return false;
    }
    if (gapDaysTotalCount > 0) {
      const msg = t(
        'salesEntryGapDaysConfirm',
        formatGapDaysLabel(gapDays, gapDaysTotalCount),
        formatSaudiDate(txDate),
      );
      if (!window.confirm(msg)) return false;
    }
    return true;
  }

  function handleSave(sendWhatsAppAfter = false) {
    if (!companyId || saving || !allFormsValid || !txDate) return;
    if (!confirmSaveWarnings()) return;

    const items = activeShifts.map((s) =>
      buildShiftEntryPayload(s, shiftForms[s]!, salesChannels),
    );

    const onSaveSuccess = (summaries: SavedSummary[], usedLegacyNoShift = false) => {
      if (usedLegacyNoShift) {
        showToast(t('salesEntryLegacyServerWarning'), 'error');
      }
      if (sendWhatsAppAfter && summaries.length > 0) {
        openDailyWhatsApp(summaries, items);
      }
      if (autoCloseOnSuccess) {
        onSuccess?.(summaries.length === 1 ? summaries[0] : summaries);
        onClose?.();
        return;
      }
      setSavedSummaries(summaries);
      setSavedEntryItems(items);
      onSuccess?.(summaries.length === 1 ? summaries[0] : summaries);
    };

    if (isBatch && createSummaryBatch) {
      const batchIdempotencyKey = `sales-batch-${companyId}-${txDate}-${Date.now()}`;
      createSummaryBatch.mutate(
        {
          companyId,
          transactionDate: txDate,
          items,
          batchIdempotencyKey,
        },
        {
          onSuccess: (res: { data?: { summaries?: SavedSummary[]; usedLegacyNoShift?: boolean } }) => {
            const data = res?.data ?? res;
            const pack = data as { summaries?: SavedSummary[]; usedLegacyNoShift?: boolean };
            onSaveSuccess(pack.summaries ?? [], !!pack.usedLegacyNoShift);
          },
          onError: (e: unknown) => onError?.(formatSaveError(e)),
        },
      );
      return;
    }

    const single = items[0];
    const idempotencyKey = `sales-${companyId}-${txDate}-${single.shift}-${Date.now()}`;
    createSummary.mutate(
      buildCreateSalesSummaryApiBody({
        companyId,
        transactionDate: txDate,
        customerCount: single.customerCount,
        cashOnHand: single.cashOnHand,
        shift: single.shift,
        channels: single.channels,
        notes: single.notes,
        idempotencyKey,
        omitIdempotencyKey: true,
      }),
      {
        onSuccess: (res: { data?: { summary?: SavedSummary }; summary?: SavedSummary }) => {
          const data = res?.data ?? res;
          const summary = (data as { summary?: SavedSummary })?.summary ?? (data as SavedSummary);
          onSaveSuccess([summary]);
        },
        onError: (e: unknown) => onError?.(formatSaveError(e)),
      },
    );
  }

  function formatSaveError(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e ?? '');
    return msg.trim() || t('saveFailed');
  }

  if (savedSummaries && savedSummaries.length > 0) {
    const multi = savedSummaries.length > 1;
    return (
      <AdaptiveSheet
        open={true}
        onClose={() => { void resetForm().then(() => onClose?.()); }}
        title={t('summarySaved')}
        size="sm"
        side="start"
        className="sales-entry-success-drawer"
        footer={
          <>
            <Button onClick={() => { void resetForm(); }}>{t('addNewSummary')}</Button>
            <Button variant="ghost" onClick={() => { onClose?.(); void resetForm(); }}>{t('close')}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {savedSummaries.map((s, i) => (
            <div
              key={String(s.id ?? s.summaryNumber)}
              className="flex flex-col gap-2 rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-noorix-muted">
                  {getSalesShiftLabel(
                    savedEntryItems?.[i]?.shift
                      ? parseSalesShiftValue(savedEntryItems[i].shift, 'all')
                      : resolveSalesSummaryShift(s),
                    t,
                  )}
                </span>
                <strong className="text-[13px] text-noorix-blue">#{s.summaryNumber}</strong>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-noorix-muted">{t('total')}</span>
                <span dir="ltr" className="font-bold text-noorix-green nx-font-numbers">
                  <FmtNum n={Number(s.totalAmount ?? 0)} /> <span className="nx-sar">SR</span>
                </span>
              </div>
            </div>
          ))}
          {multi ? (
            <Button
              variant="success"
              size="md"
              className="w-full"
              onClick={() => openDailyWhatsApp(savedSummaries, savedEntryItems)}
            >
              {t('sendWhatsApp')} — {t('salesDailyWaTitle')}
            </Button>
          ) : (
            <Button
              variant="success"
              size="md"
              className="w-full"
              onClick={() => {
                if (!savedSummaries?.length) return;
                const entryPayloads = (savedEntryItems ?? []).map((item) => {
                  const shift = parseSalesShiftValue(item.shift, 'all');
                  const form = shiftForms[shift];
                  return form
                    ? buildShiftEntryPayload(shift, form, salesChannels)
                    : { shift: item.shift, channels: [] as { vaultId: string; amount: string }[] };
                });
                const [enriched] = enrichSummariesWithEntryChannels(savedSummaries, entryPayloads);
                onWhatsApp?.(enriched ?? savedSummaries[0]);
              }}
            >
              {t('sendWhatsApp')} — {t('salesDailySummary')}
            </Button>
          )}
        </div>
      </AdaptiveSheet>
    );
  }

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={t('dailySummaryInput')}
      size="md"
      side="start"
      className="sales-entry-drawer"
      footer={
        isBatch ? (
          <Button onClick={resetForm} className="w-full">{t('reset')}</Button>
        ) : (
          <>
            <Button
              variant="primary"
              disabled={saveDisabled}
              onClick={() => handleSave(false)}
              className="flex-1 min-w-0"
            >
              {saving ? t('saving') : t('saveSummary')}
            </Button>
            <Button onClick={resetForm}>{t('reset')}</Button>
          </>
        )
      }
    >
      <div className="mb-4 flex flex-col gap-2">
        <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/50 px-3 py-2 text-[12px] leading-relaxed text-noorix-muted">
          {contextLoading ? t('loading') : dateBannerText}
        </div>
        <Input
          type="date"
          label={t('transactionDate')}
          value={txDate}
          onChange={(e: { target: { value: string } }) => {
            setDateTouched(true);
            setTxDate(e.target.value);
          }}
        />
        {showDateDiffersHint && (
          <p className="m-0 text-[11px] text-noorix-amber leading-relaxed">
            {t('salesEntryDateDiffersHint', formatSaudiDate(suggestedDate))}
          </p>
        )}
        {duplicateShiftHint && (
          <p className="m-0 text-[11px] text-noorix-amber leading-relaxed">
            {duplicateShiftHint}
          </p>
        )}
        {gapDaysHint && (
          <p className="m-0 text-[11px] text-noorix-amber leading-relaxed">
            {gapDaysHint}
          </p>
        )}
      </div>

      <SalesShiftPicker mode="entry" selection={selection} onChange={setSelection} className="mb-4" />

      <div className="flex flex-col gap-4">
        {activeShifts.map((shift) => {
          const form = shiftForms[shift] ?? emptyShiftEntryForm();
          return (
            <SalesShiftEntryCard
              key={shift}
              shift={shift}
              form={form}
              onChange={(next) => setShiftForms((prev) => ({ ...prev, [shift]: next }))}
              salesChannels={salesChannels}
              salesChannelsLoading={salesChannelsLoading}
              salesChannelsError={salesChannelsError}
              lang={lang}
              vatEnabled={vatEnabled}
              vatRate={vatRate}
              t={t}
              showCopyFromMorning={shift === 'evening' && activeShifts.includes('morning')}
              onCopyFromMorning={
                shift === 'evening' && shiftForms.morning
                  ? () => {
                      const m = shiftForms.morning!;
                      setShiftForms((prev) => ({
                        ...prev,
                        evening: {
                          ...form,
                          channelAmounts: { ...m.channelAmounts },
                        },
                      }));
                    }
                  : undefined
              }
            />
          );
        })}
      </div>

      {isBatch && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="flex-1 min-w-0">
            <SalesDualShiftEntryReport
              rows={dualShiftPreviewRows}
              grandTotal={grandTotal.total.toNumber()}
              grandCustomers={grandTotal.customers}
              t={t}
            />
          </div>
          <Button
            variant="success"
            size="md"
            disabled={saveDisabled}
            onClick={() => handleSave(true)}
            className="shrink-0 min-h-[44px] sm:min-w-[min(100%,200px)] sm:self-stretch sm:px-4"
          >
            {saving ? t('saving') : t('salesEntrySaveAndWhatsApp')}
          </Button>
        </div>
      )}

      {!hasEntrySelection(selection) && (
        <p className="m-0 mt-2 text-center text-[12px] text-noorix-muted">{t('salesEntryPickShift')}</p>
      )}
    </AdaptiveSheet>
  );
}
