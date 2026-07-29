import { useCallback, useEffect, useMemo, useRef } from 'react';
import Decimal from 'decimal.js';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { usePrintPreview } from '../../../ui';
import { fmt } from '../../../utils/format';
import { getSaudiYearMonth } from '../../../utils/saudiDate';
import {
  computeCostAppsPl,
} from '../costAccountingAppsModel';
import {
  formatCommissionPctForColumnLabel,
  formatYearMonthLabel,
  importMonthKeyFromRange,
  lastDayOfMonth,
  parseMoneyInput,
  ymdParts,
} from './costAccountingAppsScreenUtils';
import { buildCostAppsReportPrintHtml, exportCostAppsReportExcel } from './costAccountingAppsScreenActions';
import { useCostAccountingAppsCalculationActions } from './useCostAccountingAppsCalculationActions';
import { useCostAccountingAppsDraftState } from './useCostAccountingAppsDraftState';
import { useCostAccountingAppsImports } from './useCostAccountingAppsImports';
import { useCostAccountingAppsSavedScenarios } from './useCostAccountingAppsSavedScenarios';

type AppCompanyLite = {
  id?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  logoUrl?: string | null;
};

export function useCostAccountingAppsScreen() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const company = companies?.find((c: AppCompanyLite) => c.id === activeCompanyId);
  const companyName =
    lang === 'en' ? company?.nameEn || company?.nameAr || '' : company?.nameAr || company?.nameEn || '';
  const companyLogoUrl = String(company?.logoUrl || '').trim();
  const { openPrintPreview, printPreviewModal } = usePrintPreview({
    title: t('reportCostAppsTitle'),
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });

  const {
    grossAppStr,
    setGrossAppStr,
    grossCashStr,
    setGrossCashStr,
    grossBankStr,
    setGrossBankStr,
    vatInclusive,
    setVatInclusive,
    vatRatePctStr,
    setVatRatePctStr,
    commissionPctStr,
    setCommissionPctStr,
    commissionBase,
    setCommissionBase,
    fixedLines,
    setFixedLines,
    importFrom,
    setImportFrom,
    importTo,
    setImportTo,
    salaryStr,
    setSalaryStr,
    targetProfitStr,
    setTargetProfitStr,
    reverseGrossStr,
    setReverseGrossStr,
    appSharePctStr,
    setAppSharePctStr,
    cogsLocalPctStr,
    setCogsLocalPctStr,
    appPriceMarkupPctStr,
    setAppPriceMarkupPctStr,
    reverseAppSharePctStr,
    setReverseAppSharePctStr,
    probeSalesGrossStr,
    setProbeSalesGrossStr,
    probePlPreview,
    setProbePlPreview,
    applyScenarioRestore,
    savedScenarioSnapshot,
    resetDraftState,
  } = useCostAccountingAppsDraftState({ activeCompanyId });
  const {
    importing,
    importingExpenses,
    setImporting,
    setImportingExpenses,
    handleImportSystem,
    handleImportExpensesFromSystem,
    handleCsvPick,
  } = useCostAccountingAppsImports({
    activeCompanyId,
    lang,
    importFrom,
    importTo,
    t,
    showToast,
    setGrossAppStr,
    setGrossCashStr,
    setGrossBankStr,
    setFixedLines,
    setSalaryStr,
  });

  useEffect(() => {
    if (!activeCompanyId) return;
    setImporting(false);
    setImportingExpenses(false);
  }, [activeCompanyId, setImporting, setImportingExpenses]);

  const vatRateDec = useMemo(() => {
    const p = parseMoneyInput(vatRatePctStr);
    return p.div(100);
  }, [vatRatePctStr]);

  const commissionPctDec = useMemo(() => parseMoneyInput(commissionPctStr), [commissionPctStr]);

  const withAppsScenarioLabel = useMemo(
    () => t('reportCostAppsScenarioWithAppsPct', { pct: formatCommissionPctForColumnLabel(commissionPctDec) }),
    [t, commissionPctDec],
  );

  const fixedTotal = useMemo(() => {
    return fixedLines.reduce((acc, line) => acc.plus(parseMoneyInput(line.amount)), new Decimal(0));
  }, [fixedLines]);

  const grossApp = useMemo(() => parseMoneyInput(grossAppStr), [grossAppStr]);
  const grossCash = useMemo(() => parseMoneyInput(grossCashStr), [grossCashStr]);
  const grossBank = useMemo(() => parseMoneyInput(grossBankStr), [grossBankStr]);

  const grossInputsSum = useMemo(() => grossApp.plus(grossCash).plus(grossBank), [grossApp, grossCash, grossBank]);

  const salaryTotal = useMemo(() => parseMoneyInput(salaryStr), [salaryStr]);

  const expensesMonthlyTotal = useMemo(() => fixedTotal.plus(salaryTotal), [fixedTotal, salaryTotal]);
  const expensesAnnualTotal = useMemo(() => expensesMonthlyTotal.mul(12), [expensesMonthlyTotal]);

  const baseParams = useMemo(
    () => ({
      grossApp,
      grossLocalCash: grossCash,
      grossLocalBank: grossBank,
      vatInclusive,
      vatRate: vatRateDec,
      commissionPct: commissionPctDec,
      commissionBase,
      fixedTotal,
      salaryTotal,
      cogsLocalPct: parseMoneyInput(cogsLocalPctStr),
      appPriceMarkupPct: parseMoneyInput(appPriceMarkupPctStr),
    }),
    [
      grossApp,
      grossCash,
      grossBank,
      vatInclusive,
      vatRateDec,
      commissionPctDec,
      commissionBase,
      fixedTotal,
      salaryTotal,
      cogsLocalPctStr,
      appPriceMarkupPctStr,
    ],
  );

  const plWith = useMemo(() => computeCostAppsPl({ ...baseParams, includeAppChannel: true }), [baseParams]);
  const plWithout = useMemo(() => computeCostAppsPl({ ...baseParams, includeAppChannel: false }), [baseParams]);

  const appSalesRowLabel = useMemo(
    () =>
      t('reportCostAppsPlAppSalesShare', {
        pct: formatCommissionPctForColumnLabel(plWith.appShareOfGrossPct),
      }),
    [t, plWith.appShareOfGrossPct],
  );

  const importYearForPicker = useMemo(() => {
    const y = parseInt(importFrom.slice(0, 4), 10);
    return Number.isFinite(y) && y >= 2000 ? y : getSaudiYearMonth().year;
  }, [importFrom]);

  const importMonthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const y = importYearForPicker;
        return {
          value: `${y}-${String(m).padStart(2, '0')}`,
          label: formatYearMonthLabel(y, m, lang),
        };
      }),
    [importYearForPicker, lang],
  );

  const importMonthSelectValue = useMemo(() => {
    const k = importMonthKeyFromRange(importFrom, importTo);
    if (k) return k;
    if (importFrom.length >= 7) {
      const m = parseInt(importFrom.slice(5, 7), 10);
      if (Number.isFinite(m) && m >= 1 && m <= 12) {
        return `${importYearForPicker}-${String(m).padStart(2, '0')}`;
      }
    }
    const sa = getSaudiYearMonth();
    return `${sa.year}-${String(sa.month).padStart(2, '0')}`;
  }, [importFrom, importTo, importYearForPicker]);

  const fmt2 = (d: Decimal) => fmt(d.toNumber());

  const {
    savedSlots,
    previewSlot,
    setPreviewSlot,
    reloadSavedSlots,
    handleSaveCalculatorSlot,
    handleImportSavedSlot,
    handleDeleteSavedSlot,
  } = useCostAccountingAppsSavedScenarios({
    activeCompanyId,
    lang,
    t,
    showToast,
    companyName,
    applyScenarioRestore,
    snapshot: savedScenarioSnapshot,
  });

  useEffect(() => {
    reloadSavedSlots();
  }, [reloadSavedSlots]);

  const {
    handleReverse,
    handleProbeProfit,
    handleApplyProbeToFields,
    handleApplyReverse,
    handleApplyAppShare,
  } = useCostAccountingAppsCalculationActions({
    t,
    showToast,
    fixedTotal,
    salaryTotal,
    grossCash,
    grossBank,
    currentGrossTotal: plWith.grossTotal,
    vatInclusive,
    vatRateDec,
    commissionPctDec,
    commissionBase,
    cogsLocalPctStr,
    appPriceMarkupPctStr,
    reverseAppSharePctStr,
    targetProfitStr,
    reverseGrossStr,
    probeSalesGrossStr,
    appSharePctStr,
    setReverseGrossStr,
    setProbePlPreview,
    setGrossAppStr,
    setGrossCashStr,
    setGrossBankStr,
  });

  const handlePrint = useCallback(() => {
    const html = buildCostAppsReportPrintHtml({
      t,
      companyName,
      logoUrl: companyLogoUrl,
      appSalesRowLabel,
      withAppsScenarioLabel,
      plWith,
      plWithout,
      fixedLines,
      salaryStr,
      expensesMonthlyTotal,
      expensesAnnualTotal,
    });
    openPrintPreview({ title: t('reportCostAppsTitle'), html });
  }, [appSalesRowLabel, companyLogoUrl, companyName, expensesAnnualTotal, expensesMonthlyTotal, fixedLines, openPrintPreview, plWith, plWithout, salaryStr, t, withAppsScenarioLabel]);

  const handleExportExcel = useCallback(async () => {
    await exportCostAppsReportExcel({
      t,
      companyName,
      logoUrl: companyLogoUrl,
      appSalesRowLabel,
      withAppsScenarioLabel,
      plWith,
      plWithout,
    });
  }, [appSalesRowLabel, companyLogoUrl, companyName, plWith, plWithout, t, withAppsScenarioLabel]);

  const clearDraft = useCallback(() => {
    if (!activeCompanyId) return;
    resetDraftState();
    setImporting(false);
    showToast(lang === 'ar' ? 'تم المسح.' : 'Cleared.', 'success');
  }, [activeCompanyId, lang, resetDraftState, setImporting, showToast]);

  return {
    activeCompanyId,
    t,
    lang,
    fileRef,
    companyName,
    grossAppStr,
    setGrossAppStr,
    grossCashStr,
    setGrossCashStr,
    grossBankStr,
    setGrossBankStr,
    vatInclusive,
    setVatInclusive,
    vatRatePctStr,
    setVatRatePctStr,
    commissionPctStr,
    setCommissionPctStr,
    commissionBase,
    setCommissionBase,
    fixedLines,
    setFixedLines,
    importFrom,
    setImportFrom,
    importTo,
    setImportTo,
    importing,
    importingExpenses,
    salaryStr,
    setSalaryStr,
    targetProfitStr,
    setTargetProfitStr,
    reverseGrossStr,
    appSharePctStr,
    setAppSharePctStr,
    cogsLocalPctStr,
    setCogsLocalPctStr,
    appPriceMarkupPctStr,
    setAppPriceMarkupPctStr,
    reverseAppSharePctStr,
    setReverseAppSharePctStr,
    probeSalesGrossStr,
    setProbeSalesGrossStr,
    probePlPreview,
    savedSlots,
    previewSlot,
    setPreviewSlot,
    withAppsScenarioLabel,
    fixedTotal,
    grossInputsSum,
    expensesMonthlyTotal,
    expensesAnnualTotal,
    plWith,
    plWithout,
    appSalesRowLabel,
    importMonthOptions,
    importMonthSelectValue,
    fmt2,
    handleImportSystem,
    handleImportExpensesFromSystem,
    handleCsvPick,
    handleReverse,
    handleProbeProfit,
    handleApplyProbeToFields,
    handleApplyReverse,
    handleApplyAppShare,
    handlePrint,
    printPreviewModal,
    handleExportExcel,
    clearDraft,
    handleSaveCalculatorSlot,
    handleImportSavedSlot,
    handleDeleteSavedSlot,
  };
}
