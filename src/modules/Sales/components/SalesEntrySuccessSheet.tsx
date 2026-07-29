import React from 'react';
import { AdaptiveSheet, Button, DialogActions, FmtNum } from '../../../ui';
import { compactBusinessIdentifier } from '../../../utils/compactDisplay';
import { getSalesShiftLabel, parseSalesShiftValue, resolveSalesSummaryShift } from '../constants/salesShift';
import type { ShiftEntryFormState } from '../constants/salesShiftEntry';
import { buildShiftEntryPayload } from './SalesShiftEntryCard';
import type { SalesInputVaultRef } from '../../../types/api/domains/sales';
import type { SalesShiftValue } from '../constants/salesShift';
import type { SalesEntryItem, SalesEntryTranslate, SavedSummary } from './SalesEntryModalTypes';

type SalesEntrySuccessSheetProps = {
  t: SalesEntryTranslate;
  savedSummaries: SavedSummary[];
  savedEntryItems: SalesEntryItem[] | null;
  shiftForms: Partial<Record<SalesShiftValue, ShiftEntryFormState>>;
  salesChannels: SalesInputVaultRef[];
  resetForm: () => Promise<void>;
  onClose?: () => void;
  onWhatsApp?: (summary: SavedSummary) => void;
  openDailyWhatsApp: (summaries: SavedSummary[], entryItems?: SalesEntryItem[] | null) => Promise<void>;
  enrichSummariesWithEntryChannels: (summaries: SavedSummary[], items: SalesEntryItem[]) => SavedSummary[];
};

export function SalesEntrySuccessSheet({
  t,
  savedSummaries,
  savedEntryItems,
  shiftForms,
  salesChannels,
  resetForm,
  onClose,
  onWhatsApp,
  openDailyWhatsApp,
  enrichSummariesWithEntryChannels,
}: SalesEntrySuccessSheetProps) {
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
        <DialogActions
          actions={[
            {
              key: 'close',
              label: t('close'),
              role: 'close',
              onClick: () => {
                onClose?.();
                void resetForm();
              },
            },
            {
              key: 'add-new-summary',
              label: t('addNewSummary'),
              role: 'primary',
              onClick: () => {
                void resetForm();
              },
            },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-4">
        {savedSummaries.map((summary, index) => (
          <div
            key={String(summary.id ?? summary.summaryNumber)}
            className="flex flex-col gap-2 rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-noorix-muted">
                {getSalesShiftLabel(
                  savedEntryItems?.[index]?.shift
                    ? parseSalesShiftValue(savedEntryItems[index].shift, 'all')
                    : resolveSalesSummaryShift(summary),
                  t,
                )}
              </span>
              <strong className="text-[13px] text-noorix-blue" title={String(summary.summaryNumber || '')}>
                #{compactBusinessIdentifier(summary.summaryNumber)}
              </strong>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-noorix-muted">{t('total')}</span>
              <span dir="ltr" className="font-bold text-noorix-green nx-font-numbers">
                <FmtNum n={Number(summary.totalAmount ?? 0)} /> <span className="nx-sar">SR</span>
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
            {t('sendWhatsApp')} - {t('salesDailyWaTitle')}
          </Button>
        ) : (
          <Button
            variant="success"
            size="md"
            className="w-full"
            onClick={() => {
              const entryPayloads = (savedEntryItems ?? []).map((item) => {
                const shift = parseSalesShiftValue(item.shift, 'all');
                const form = shiftForms[shift];
                return form ? buildShiftEntryPayload(shift, form, salesChannels) : item;
              });
              const [enriched] = enrichSummariesWithEntryChannels(savedSummaries, entryPayloads);
              onWhatsApp?.(enriched ?? savedSummaries[0]);
            }}
          >
            {t('sendWhatsApp')} - {t('salesDailySummary')}
          </Button>
        )}
      </div>
    </AdaptiveSheet>
  );
}
