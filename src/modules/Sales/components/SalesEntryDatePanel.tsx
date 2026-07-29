import React from 'react';
import { TransactionDatePicker } from '../../../ui';
import { formatSaudiDate } from '../../../utils/saudiDate';
import type { SalesEntryTranslate } from './SalesEntryModalTypes';

type SalesEntryDatePanelProps = {
  t: SalesEntryTranslate;
  txDate: string;
  suggestedDate: string;
  contextLoading: boolean;
  dateBannerText: string;
  showDateDiffersHint: boolean;
  duplicateShiftHint: string;
  gapDaysHint: string;
  onDateChange: (value: string) => void;
};

export function SalesEntryDatePanel({
  t,
  txDate,
  suggestedDate,
  contextLoading,
  dateBannerText,
  showDateDiffersHint,
  duplicateShiftHint,
  gapDaysHint,
  onDateChange,
}: SalesEntryDatePanelProps) {
  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/50 px-3 py-2 text-[12px] leading-relaxed text-noorix-muted">
        {contextLoading ? t('loading') : dateBannerText}
      </div>
      <TransactionDatePicker label={t('transactionDate')} value={txDate} onValueChange={onDateChange} />
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
  );
}
