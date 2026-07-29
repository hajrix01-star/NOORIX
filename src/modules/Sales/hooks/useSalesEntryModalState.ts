import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { salesKeys } from '../../../services/queryKeys';
import { getSaudiToday } from '../../../utils/saudiDate';
import type { SalesShiftValue } from '../constants/salesShift';
import {
  EMPTY_SALES_ENTRY_SELECTION,
  getActiveEntryShifts,
  type SalesEntrySelection,
  type ShiftEntryFormState,
} from '../constants/salesShiftEntry';
import { isShiftEntryFormValid } from '../components/SalesShiftEntryCard';
import type { SalesEntryItem, SalesEntryTranslate, SavedSummary } from '../components/SalesEntryModalTypes';
import { useSalesEntryDateContext } from './useSalesEntryDateContext';
import { compareYmd } from '../utils/suggestSalesEntryDate';
import {
  buildSalesEntryDateBanner,
  buildSalesEntryWarningHints,
  confirmSalesEntrySaveWarnings,
} from '../utils/salesEntryWarnings';
import {
  buildSalesEntryGrandTotal,
  ensureSalesEntryShiftForms,
  isSalesEntrySaveDisabled,
} from '../utils/salesEntryModalModel';
import type { SalesInputVaultRef } from '../../../types/api/domains/sales';

type SalesEntryModalStateInput = {
  companyId: string;
  salesChannels: SalesInputVaultRef[];
  salesChannelsLoading: boolean;
  salesChannelsError: string;
  saving: boolean;
  t: SalesEntryTranslate;
  lang: string;
};

export type SalesEntryModalState = {
  txDate: string;
  suggestedDate: string;
  contextLoading: boolean;
  handleDateChange: (value: string) => void;
  selection: SalesEntrySelection;
  setSelection: Dispatch<SetStateAction<SalesEntrySelection>>;
  shiftForms: Partial<Record<SalesShiftValue, ShiftEntryFormState>>;
  setShiftForms: Dispatch<SetStateAction<Partial<Record<SalesShiftValue, ShiftEntryFormState>>>>;
  savedSummaries: SavedSummary[] | null;
  setSavedSummaries: Dispatch<SetStateAction<SavedSummary[] | null>>;
  savedEntryItems: SalesEntryItem[] | null;
  setSavedEntryItems: Dispatch<SetStateAction<SalesEntryItem[] | null>>;
  activeShifts: SalesShiftValue[];
  isBatch: boolean;
  grandTotal: { total: Decimal; customers: number };
  allFormsValid: boolean;
  resetForm: () => Promise<void>;
  saveDisabled: boolean;
  dateBannerText: string;
  showDateDiffersHint: boolean;
  duplicateShiftHint: string;
  gapDaysHint: string;
  confirmSaveWarnings: () => boolean;
};

export function useSalesEntryModalState({
  companyId,
  salesChannels,
  salesChannelsLoading,
  salesChannelsError,
  saving,
  t,
  lang,
}: SalesEntryModalStateInput): SalesEntryModalState {
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

  useEffect(() => {
    setDateTouched(false);
    dateAutoAppliedRef.current = false;
    setTxDate('');
    setSelection(EMPTY_SALES_ENTRY_SELECTION);
    setShiftForms({});
    setSavedSummaries(null);
    setSavedEntryItems(null);
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

  const grandTotal = useMemo(
    () => buildSalesEntryGrandTotal(activeShifts, shiftForms),
    [activeShifts, shiftForms],
  );

  const allFormsValid = useMemo(
    () => activeShifts.length > 0 && activeShifts.every((shift) => {
      const form = shiftForms[shift];
      return !!form && isShiftEntryFormValid(form, salesChannels);
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

  const handleDateChange = useCallback((value: string) => {
    setDateTouched(true);
    setTxDate(value);
  }, []);

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

  const confirmSaveWarnings = useCallback(() => confirmSalesEntrySaveWarnings({
    t,
    lang,
    txDate,
    duplicateShifts,
    duplicateShiftHint,
    gapDays,
    gapDaysTotalCount,
  }), [duplicateShiftHint, duplicateShifts, gapDays, gapDaysTotalCount, lang, t, txDate]);

  return {
    txDate,
    suggestedDate,
    contextLoading,
    handleDateChange,
    selection,
    setSelection,
    shiftForms,
    setShiftForms,
    savedSummaries,
    setSavedSummaries,
    savedEntryItems,
    setSavedEntryItems,
    activeShifts,
    isBatch: activeShifts.length > 1,
    grandTotal,
    allFormsValid,
    resetForm,
    saveDisabled,
    dateBannerText,
    showDateDiffersHint,
    duplicateShiftHint,
    gapDaysHint,
    confirmSaveWarnings,
  };
}
