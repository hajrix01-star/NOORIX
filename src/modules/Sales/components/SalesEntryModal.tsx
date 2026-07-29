import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Decimal from 'decimal.js';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { getSaudiToday, formatSaudiDate, formatSaudiWeekdayName } from '../../../utils/saudiDate';
import { sumObjectValues } from '@noorix/finance-core';
import { Button, DialogActions, AdaptiveSheet } from '../../../ui';
import { SalesShiftPicker } from './SalesShiftPicker';
import { isShiftEntryFormValid, buildShiftEntryPayload } from './SalesShiftEntryCard';
import { SalesDualShiftEntryReport, buildDualShiftPreviewRows } from './SalesDualShiftEntryReport';
import type { SalesShiftValue } from '../constants/salesShift';
import {
  EMPTY_SALES_ENTRY_SELECTION,
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
import {
  buildSalesEntryDateBanner,
  buildSalesEntryWarningHints,
  confirmSalesEntrySaveWarnings,
  formatSalesEntrySaveError,
} from '../utils/salesEntryWarnings';
import { ensureSalesEntryShiftForms, isSalesEntrySaveDisabled } from '../utils/salesEntryModalModel';
import { useQueryClient } from '@tanstack/react-query';
import { salesKeys } from '../../../services/queryKeys';
import type { SalesEntryItem, SalesEntryModalProps, SavedSummary } from './SalesEntryModalTypes';
import { SalesEntryDatePanel } from './SalesEntryDatePanel';
import { SalesEntrySuccessSheet } from './SalesEntrySuccessSheet';
import { SalesEntryShiftFormsList } from './SalesEntryShiftFormsList';
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
}: SalesEntryModalProps) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [txDate, setTxDate] = useState('');
  const [dateTouched, setDateTouched] = useState(false);
  const dateAutoAppliedRef = useRef(false);
  const [selection, setSelection] = useState<SalesEntrySelection>(EMPTY_SALES_ENTRY_SELECTION);
  const [shiftForms, setShiftForms] = useState<Partial<Record<SalesShiftValue, ShiftEntryFormState>>>({});
  const [savedSummaries, setSavedSummaries] = useState<SavedSummary[] | null>(null);
  const [savedEntryItems, setSavedEntryItems] = useState<SalesEntryItem[] | null>(null);
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
    setShiftForms((prev) => ensureSalesEntryShiftForms(prev, activeShifts));
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
    items: SalesEntryItem[],
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
    entryItems?: SalesEntryItem[] | null,
  ) => {
    const enriched = entryItems?.length
      ? enrichSummariesWithEntryChannels(summaries, entryItems)
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

  const saveDisabled = isSalesEntrySaveDisabled({
    saving,
    salesChannelsLoading,
    salesChannelsError,
    salesChannelsCount: salesChannels.length,
    selection,
    allFormsValid,
    txDate,
    contextLoading,
    daySummariesLoading,
  });

  const dateBannerText = useMemo(
    () => buildSalesEntryDateBanner(t, lastEntryYmd, suggestedDate),
    [lastEntryYmd, suggestedDate, t],
  );

  const showDateDiffersHint = !!txDate
    && !!suggestedDate
    && compareYmd(txDate, suggestedDate) !== 0;

  const { duplicateShiftHint, gapDaysHint } = buildSalesEntryWarningHints({
    t,
    lang,
    txDate,
    suggestedDate,
    lastEntryYmd,
    duplicateShifts,
    gapDays,
    gapDaysTotalCount,
  });

  function confirmSaveWarnings(): boolean {
    return confirmSalesEntrySaveWarnings({
      t,
      lang,
      txDate,
      duplicateShifts,
      duplicateShiftHint,
      gapDays,
      gapDaysTotalCount,
    });
  }

  function handleSave(sendWhatsAppAfter = false) {
    if (!companyId || saving || !allFormsValid || !txDate) return;
    if (!confirmSaveWarnings()) return;

    const items = activeShifts.map((s) =>
      buildShiftEntryPayload(s, shiftForms[s]!, salesChannels),
    );

    const onSaveSuccess = (summaries: SavedSummary[]) => {
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
          onSuccess: (res) => {
            const data = res?.data ?? res;
            onSaveSuccess(data.summaries ?? []);
          },
          onError: (e: unknown) => onError?.(formatSalesEntrySaveError(e, t('saveFailed'))),
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
        onSuccess: (res) => {
          const data = res?.data ?? res;
          const summary = data.summary ?? data;
          onSaveSuccess(summary && 'id' in summary ? [summary] : []);
        },
        onError: (e: unknown) => onError?.(formatSalesEntrySaveError(e, t('saveFailed'))),
      },
    );
  }

  if (savedSummaries && savedSummaries.length > 0) {
    return (
      <SalesEntrySuccessSheet
        t={t}
        savedSummaries={savedSummaries}
        savedEntryItems={savedEntryItems}
        shiftForms={shiftForms}
        salesChannels={salesChannels}
        resetForm={resetForm}
        onClose={onClose}
        onWhatsApp={onWhatsApp}
        openDailyWhatsApp={openDailyWhatsApp}
        enrichSummariesWithEntryChannels={enrichSummariesWithEntryChannels}
      />
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
          <DialogActions
            actions={[
              { key: 'reset', label: t('reset'), role: 'secondary', onClick: resetForm },
            ]}
            className="w-full"
          />
        ) : (
          <DialogActions
            actions={[
              { key: 'reset', label: t('reset'), role: 'secondary', onClick: resetForm },
              {
                key: 'save-summary',
                label: saving ? t('saving') : t('saveSummary'),
                role: 'save',
                disabled: saveDisabled,
                onClick: () => handleSave(false),
              },
            ]}
          />
        )
      }
    >
      <SalesEntryDatePanel
        t={t}
        txDate={txDate}
        suggestedDate={suggestedDate}
        contextLoading={contextLoading}
        dateBannerText={dateBannerText}
        showDateDiffersHint={showDateDiffersHint}
        duplicateShiftHint={duplicateShiftHint}
        gapDaysHint={gapDaysHint}
        onDateChange={(value) => {
          setDateTouched(true);
          setTxDate(value);
        }}
      />

      <SalesShiftPicker mode="entry" selection={selection} onChange={setSelection} className="mb-4" />

      <SalesEntryShiftFormsList
        activeShifts={activeShifts}
        shiftForms={shiftForms}
        setShiftForms={setShiftForms}
        salesChannels={salesChannels}
        salesChannelsLoading={salesChannelsLoading}
        salesChannelsError={salesChannelsError}
        lang={lang}
        vatEnabled={vatEnabled}
        vatRate={vatRate}
        t={t}
      />

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
