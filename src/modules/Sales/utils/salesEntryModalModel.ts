import Decimal from 'decimal.js';
import { sumObjectValues } from '@noorix/finance-core';
import { emptyShiftEntryForm, hasEntrySelection, type SalesEntrySelection, type ShiftEntryFormState } from '../constants/salesShiftEntry';
import type { SalesShiftValue } from '../constants/salesShift';

export function ensureSalesEntryShiftForms(
  prev: Partial<Record<SalesShiftValue, ShiftEntryFormState>>,
  active: SalesShiftValue[],
): Partial<Record<SalesShiftValue, ShiftEntryFormState>> {
  const next = { ...prev };
  for (const shift of active) {
    if (!next[shift]) next[shift] = emptyShiftEntryForm();
  }
  return next;
}

export function buildSalesEntryGrandTotal(
  activeShifts: SalesShiftValue[],
  shiftForms: Partial<Record<SalesShiftValue, ShiftEntryFormState>>,
): { total: Decimal; customers: number } {
  let total = new Decimal(0);
  let customers = 0;
  for (const shift of activeShifts) {
    const form = shiftForms[shift];
    if (!form) continue;
    total = total.plus(sumObjectValues(form.channelAmounts));
    customers += parseInt(form.customerCount, 10) || 0;
  }
  return { total, customers };
}

type SalesEntrySaveDisabledInput = {
  saving: boolean;
  salesChannelsLoading: boolean;
  salesChannelsError: string;
  salesChannelsCount: number;
  selection: SalesEntrySelection;
  allFormsValid: boolean;
  txDate: string;
  contextLoading: boolean;
  daySummariesLoading: boolean;
};

export function isSalesEntrySaveDisabled({
  saving,
  salesChannelsLoading,
  salesChannelsError,
  salesChannelsCount,
  selection,
  allFormsValid,
  txDate,
  contextLoading,
  daySummariesLoading,
}: SalesEntrySaveDisabledInput): boolean {
  return saving
    || salesChannelsLoading
    || !!salesChannelsError
    || salesChannelsCount === 0
    || !hasEntrySelection(selection)
    || !allFormsValid
    || !txDate
    || contextLoading
    || daySummariesLoading;
}
