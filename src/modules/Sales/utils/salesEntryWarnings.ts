import { formatSaudiDate } from '../../../utils/saudiDate';
import { getSalesShiftLabel } from '../constants/salesShift';
import type { SalesShiftValue } from '../constants/salesShift';
import type { SalesEntryTranslate } from '../components/SalesEntryModalTypes';

type SalesEntryWarningInput = {
  t: SalesEntryTranslate;
  lang: string;
  txDate: string;
  suggestedDate: string;
  lastEntryYmd: string | null | undefined;
  duplicateShifts: SalesShiftValue[];
  gapDays: string[];
  gapDaysTotalCount: number;
};

export function formatSalesEntryGapDaysLabel(
  days: string[],
  totalCount: number,
  t: SalesEntryTranslate,
  lang: string,
): string {
  const formatted = days.slice(0, 5).map((day) => formatSaudiDate(day));
  const remaining = Math.max(0, totalCount - formatted.length);
  if (remaining > 0) {
    formatted.push(t('salesEntryGapDaysMore', String(remaining)));
  }
  return formatted.join(lang === 'ar' ? '، ' : ', ');
}

export function buildSalesEntryDateBanner(
  t: SalesEntryTranslate,
  lastEntryYmd: string | null | undefined,
  suggestedDate: string,
): string {
  const suggestedLabel = formatSaudiDate(suggestedDate);
  if (!lastEntryYmd) return t('salesEntryDateBannerNone', suggestedLabel);
  return t('salesEntryDateBannerLastSuggested', formatSaudiDate(lastEntryYmd), suggestedLabel);
}

export function buildSalesEntryWarningHints({
  t,
  lang,
  txDate,
  duplicateShifts,
  gapDays,
  gapDaysTotalCount,
}: SalesEntryWarningInput) {
  const duplicateShiftHint = duplicateShifts.length > 0
    ? t(
      'salesEntryDuplicateShiftHint',
      duplicateShifts.map((shift) => getSalesShiftLabel(shift, t)).join(lang === 'ar' ? '، ' : ', '),
      formatSaudiDate(txDate),
    )
    : '';

  const gapDaysLabel = formatSalesEntryGapDaysLabel(gapDays, gapDaysTotalCount, t, lang);
  const gapDaysHint = gapDaysTotalCount > 0
    ? t('salesEntryGapDaysHint', gapDaysLabel, formatSaudiDate(txDate))
    : '';

  return { duplicateShiftHint, gapDaysHint, gapDaysLabel };
}

export function formatSalesEntrySaveError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.trim() || fallback;
}

type ConfirmSalesEntryWarningsInput = {
  t: SalesEntryTranslate;
  lang: string;
  txDate: string;
  duplicateShifts: SalesShiftValue[];
  duplicateShiftHint: string;
  gapDays: string[];
  gapDaysTotalCount: number;
};

export function confirmSalesEntrySaveWarnings({
  t,
  lang,
  txDate,
  duplicateShifts,
  duplicateShiftHint,
  gapDays,
  gapDaysTotalCount,
}: ConfirmSalesEntryWarningsInput): boolean {
  if (duplicateShifts.length > 0) {
    const fallback = duplicateShifts.map((shift) => getSalesShiftLabel(shift, t)).join(lang === 'ar' ? '، ' : ', ');
    window.alert(duplicateShiftHint || fallback);
    return false;
  }
  if (gapDaysTotalCount > 0) {
    const message = t(
      'salesEntryGapDaysConfirm',
      formatSalesEntryGapDaysLabel(gapDays, gapDaysTotalCount, t, lang),
      formatSaudiDate(txDate),
    );
    if (!window.confirm(message)) return false;
  }
  return true;
}
