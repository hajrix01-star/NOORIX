import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { usePrintPreview } from '../../../ui';
import { fmt } from '../../../utils/format';
import { getSaudiYearMonth } from '../../../utils/saudiDate';
import {
  computeCostAppsPl,
  reverseGrossTotalForTargetProfit,
  type CostAppsCommissionBase,
} from '../costAccountingAppsModel';
import {
  type CostAppsScenarioRestore,
} from '../costAccountingAppsScenario';
import {
  draftKey,
  defaultCostAppsDraftValues,
  formatCommissionPctForColumnLabel,
  formatYearMonthLabel,
  importMonthKeyFromRange,
  lastDayOfMonth,
  newLine,
  normalizeFixedLines,
  parseCostAppsDraft,
  parseMoneyInput,
  splitGrossByAppShare,
  ymdParts,
  type FixedLine,
} from './costAccountingAppsScreenUtils';
import { buildCostAppsReportPrintHtml, exportCostAppsReportExcel } from './costAccountingAppsScreenActions';
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

  const [grossAppStr, setGrossAppStr] = useState('');
  const [grossCashStr, setGrossCashStr] = useState('');
  const [grossBankStr, setGrossBankStr] = useState('');
  const [vatInclusive, setVatInclusive] = useState(true);
  const [vatRatePctStr, setVatRatePctStr] = useState(() => defaultCostAppsDraftValues().vatRatePctStr);
  const [commissionPctStr, setCommissionPctStr] = useState('25');
  const [commissionBase, setCommissionBase] = useState<CostAppsCommissionBase>('gross');
  const [fixedLines, setFixedLines] = useState<FixedLine[]>(() => [newLine()]);
  const sa0 = getSaudiYearMonth();
  const [importFrom, setImportFrom] = useState(() => ymdParts(sa0.year, sa0.month, 1));
  const [importTo, setImportTo] = useState(() => ymdParts(sa0.year, sa0.month, lastDayOfMonth(sa0.year, sa0.month)));
  const [salaryStr, setSalaryStr] = useState('');
  const [targetProfitStr, setTargetProfitStr] = useState('20000');
  const [reverseGrossStr, setReverseGrossStr] = useState('');
  const [appSharePctStr, setAppSharePctStr] = useState('');
  const [cogsLocalPctStr, setCogsLocalPctStr] = useState('0');
  const [appPriceMarkupPctStr, setAppPriceMarkupPctStr] = useState('0');
  /** حصة التطبيقات من إجمالي المبيعات في الحساب العكسي (%) */
  const [reverseAppSharePctStr, setReverseAppSharePctStr] = useState('30');
  /** إجمالي مبيعات لمعاينة صافي الربح (توزيع بنفس حصة التطبيقات أعلاه) */
  const [probeSalesGrossStr, setProbeSalesGrossStr] = useState('');
  const [probePlPreview, setProbePlPreview] = useState<{
    netProfit: Decimal;
    netSales: Decimal;
    commission: Decimal;
    grossTotal: Decimal;
  } | null>(null);
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

  const vatRateDec = useMemo(() => {
    /** حقل الواجهة كنسبة مئوية (مثلاً 15 = 15٪) — يُحوَّل دائماً إلى كسر عشري للنموذج. */
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

  useLayoutEffect(() => {
    if (!activeCompanyId) return;
    setImporting(false);
    setImportingExpenses(false);

    const draft = parseCostAppsDraft(localStorage.getItem(draftKey(activeCompanyId)));
    setGrossAppStr(draft.grossAppStr);
    setGrossCashStr(draft.grossCashStr);
    setGrossBankStr(draft.grossBankStr);
    setVatInclusive(draft.vatInclusive);
    setVatRatePctStr(draft.vatRatePctStr);
    setCommissionPctStr(draft.commissionPctStr);
    setCommissionBase(draft.commissionBase);
    setFixedLines(draft.fixedLines);
    setSalaryStr(draft.salaryStr);
    setImportFrom(draft.importFrom);
    setImportTo(draft.importTo);
    setCogsLocalPctStr(draft.cogsLocalPctStr);
    setAppPriceMarkupPctStr(draft.appPriceMarkupPctStr);
    setReverseAppSharePctStr(draft.reverseAppSharePctStr);
    setTargetProfitStr(draft.targetProfitStr);
    setReverseGrossStr(draft.reverseGrossStr);
    setProbeSalesGrossStr(draft.probeSalesGrossStr);
    setProbePlPreview(null);
    setAppSharePctStr(draft.appSharePctStr);
  }, [activeCompanyId]);

  useEffect(() => {
    if (!activeCompanyId) return;
    const payload = {
      grossAppStr,
      grossCashStr,
      grossBankStr,
      vatInclusive,
      vatRatePctStr,
      commissionPctStr,
      commissionBase,
      fixedLines,
      salaryStr,
      importFrom,
      importTo,
      cogsLocalPctStr,
      appPriceMarkupPctStr,
      reverseAppSharePctStr,
      targetProfitStr,
      reverseGrossStr,
      probeSalesGrossStr,
      appSharePctStr,
    };
    try {
      localStorage.setItem(draftKey(activeCompanyId), JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [
    activeCompanyId,
    grossAppStr,
    grossCashStr,
    grossBankStr,
    vatInclusive,
    vatRatePctStr,
    commissionPctStr,
    commissionBase,
    fixedLines,
    salaryStr,
    importFrom,
    importTo,
    cogsLocalPctStr,
    appPriceMarkupPctStr,
    reverseAppSharePctStr,
    targetProfitStr,
    reverseGrossStr,
    probeSalesGrossStr,
    appSharePctStr,
  ]);

  const fmt2 = (d: Decimal) => fmt(d.toNumber());

  const applyScenarioRestore = useCallback((restore: CostAppsScenarioRestore) => {
    if (restore.grossAppStr !== undefined) setGrossAppStr(restore.grossAppStr);
    if (restore.grossCashStr !== undefined) setGrossCashStr(restore.grossCashStr);
    if (restore.grossBankStr !== undefined) setGrossBankStr(restore.grossBankStr);
    if (restore.vatInclusive !== undefined) setVatInclusive(restore.vatInclusive);
    if (restore.vatRatePctStr !== undefined) setVatRatePctStr(restore.vatRatePctStr);
    if (restore.commissionPctStr !== undefined) setCommissionPctStr(restore.commissionPctStr);
    if (restore.commissionBase !== undefined) setCommissionBase(restore.commissionBase);
    if (restore.fixedLines !== undefined) setFixedLines(normalizeFixedLines(restore.fixedLines));
    if (restore.salaryStr !== undefined) setSalaryStr(restore.salaryStr);
    if (restore.importFrom !== undefined) setImportFrom(restore.importFrom);
    if (restore.importTo !== undefined) setImportTo(restore.importTo);
    if (restore.targetProfitStr !== undefined) setTargetProfitStr(restore.targetProfitStr);
    if (restore.reverseGrossStr !== undefined) setReverseGrossStr(restore.reverseGrossStr);
    if (restore.appSharePctStr !== undefined) setAppSharePctStr(restore.appSharePctStr);
    if (restore.reverseAppSharePctStr !== undefined) setReverseAppSharePctStr(restore.reverseAppSharePctStr);
    if (restore.probeSalesGrossStr !== undefined) setProbeSalesGrossStr(restore.probeSalesGrossStr);
    if (restore.cogsLocalPctStr !== undefined) setCogsLocalPctStr(restore.cogsLocalPctStr);
    if (restore.appPriceMarkupPctStr !== undefined) setAppPriceMarkupPctStr(restore.appPriceMarkupPctStr);
    setProbePlPreview(null);
  }, []);

  const savedScenarioSnapshot = useMemo(
    () => ({
      grossAppStr,
      grossCashStr,
      grossBankStr,
      vatInclusive,
      vatRatePctStr,
      commissionPctStr,
      commissionBase,
      fixedLines,
      salaryStr,
      importFrom,
      importTo,
      targetProfitStr,
      reverseGrossStr,
      appSharePctStr,
      reverseAppSharePctStr,
      probeSalesGrossStr,
      cogsLocalPctStr,
      appPriceMarkupPctStr,
    }),
    [
      appPriceMarkupPctStr,
      appSharePctStr,
      cogsLocalPctStr,
      commissionBase,
      commissionPctStr,
      fixedLines,
      grossAppStr,
      grossBankStr,
      grossCashStr,
      importFrom,
      importTo,
      reverseAppSharePctStr,
      reverseGrossStr,
      probeSalesGrossStr,
      salaryStr,
      targetProfitStr,
      vatInclusive,
      vatRatePctStr,
    ],
  );

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

  const handleReverse = useCallback(() => {
    const alphaPct = parseMoneyInput(reverseAppSharePctStr);
    const alpha = alphaPct.div(100);
    if (alpha.lt(0) || alpha.gt(1)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      setReverseGrossStr('');
      return;
    }
    const rev = reverseGrossTotalForTargetProfit({
      targetProfit: parseMoneyInput(targetProfitStr),
      fixedTotal,
      salaryTotal,
      appShareDecimal: alpha,
      vatInclusive,
      vatRate: vatRateDec,
      commissionPct: commissionPctDec,
      commissionBase,
      cogsLocalPct: parseMoneyInput(cogsLocalPctStr),
      appPriceMarkupPct: parseMoneyInput(appPriceMarkupPctStr),
    });
    if (!rev.ok) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      setReverseGrossStr('');
      return;
    }
    setReverseGrossStr(rev.grossTotal.toFixed(2));
  }, [
    appPriceMarkupPctStr,
    cogsLocalPctStr,
    commissionBase,
    commissionPctDec,
    fixedTotal,
    reverseAppSharePctStr,
    salaryTotal,
    showToast,
    t,
    targetProfitStr,
    vatInclusive,
    vatRateDec,
  ]);

  const handleProbeProfit = useCallback(() => {
    const G = parseMoneyInput(probeSalesGrossStr);
    const alphaPct = parseMoneyInput(reverseAppSharePctStr);
    const alpha = alphaPct.div(100);
    if (G.lte(0) || alpha.lt(0) || alpha.gt(1)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      setProbePlPreview(null);
      return;
    }
    const split = splitGrossByAppShare({
      grossTotal: G,
      appShare: alpha,
      currentCash: grossCash,
      currentBank: grossBank,
    });
    if (!split.ok) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      setProbePlPreview(null);
      return;
    }
    const pl = computeCostAppsPl({
      grossApp: split.grossApp,
      grossLocalCash: split.grossCash,
      grossLocalBank: split.grossBank,
      vatInclusive,
      vatRate: vatRateDec,
      commissionPct: commissionPctDec,
      commissionBase,
      fixedTotal,
      salaryTotal,
      includeAppChannel: alpha.gt(0),
      cogsLocalPct: parseMoneyInput(cogsLocalPctStr),
      appPriceMarkupPct: parseMoneyInput(appPriceMarkupPctStr),
    });
    setProbePlPreview({
      netProfit: pl.netProfit,
      netSales: pl.netSales,
      commission: pl.commission,
      grossTotal: pl.grossTotal,
    });
  }, [
    appPriceMarkupPctStr,
    cogsLocalPctStr,
    commissionBase,
    commissionPctDec,
    fixedTotal,
    grossBank,
    grossCash,
    probeSalesGrossStr,
    reverseAppSharePctStr,
    salaryTotal,
    showToast,
    t,
    vatInclusive,
    vatRateDec,
  ]);

  const handleApplyProbeToFields = useCallback(() => {
    const G = parseMoneyInput(probeSalesGrossStr);
    if (G.lte(0)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    const alphaPct = parseMoneyInput(reverseAppSharePctStr);
    const alpha = alphaPct.div(100);
    if (alpha.lt(0) || alpha.gt(1)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    const split = splitGrossByAppShare({
      grossTotal: G,
      appShare: alpha,
      currentCash: grossCash,
      currentBank: grossBank,
    });
    if (!split.ok) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    setGrossAppStr(split.grossApp.toFixed(2));
    setGrossCashStr(split.grossCash.toFixed(2));
    setGrossBankStr(split.grossBank.toFixed(2));
    showToast(t('reportCostAppsImportOk'), 'success');
  }, [grossBank, grossCash, probeSalesGrossStr, reverseAppSharePctStr, showToast, t]);

  const handleApplyReverse = useCallback(() => {
    const G = parseMoneyInput(reverseGrossStr);
    if (G.lte(0)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    const alphaPct = parseMoneyInput(reverseAppSharePctStr);
    const alpha = alphaPct.div(100);
    if (alpha.lt(0) || alpha.gt(1)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    const split = splitGrossByAppShare({
      grossTotal: G,
      appShare: alpha,
      currentCash: grossCash,
      currentBank: grossBank,
    });
    if (!split.ok) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    setGrossAppStr(split.grossApp.toFixed(2));
    setGrossCashStr(split.grossCash.toFixed(2));
    setGrossBankStr(split.grossBank.toFixed(2));
    showToast(t('reportCostAppsImportOk'), 'success');
  }, [grossBank, grossCash, reverseAppSharePctStr, reverseGrossStr, showToast, t]);

  const handleApplyAppShare = useCallback(() => {
    const G = plWith.grossTotal;
    if (G.lte(0)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    const pct = parseMoneyInput(appSharePctStr);
    if (pct.lt(0) || pct.gt(100)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    const alpha = pct.div(100);
    const split = splitGrossByAppShare({
      grossTotal: G,
      appShare: alpha,
      currentCash: grossCash,
      currentBank: grossBank,
    });
    if (!split.ok) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    setGrossAppStr(split.grossApp.toFixed(2));
    setGrossCashStr(split.grossCash.toFixed(2));
    setGrossBankStr(split.grossBank.toFixed(2));
  }, [appSharePctStr, grossBank, grossCash, plWith.grossTotal, showToast, t]);

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
    localStorage.removeItem(draftKey(activeCompanyId));
    const draft = defaultCostAppsDraftValues();
    setGrossAppStr(draft.grossAppStr);
    setGrossCashStr(draft.grossCashStr);
    setGrossBankStr(draft.grossBankStr);
    setSalaryStr(draft.salaryStr);
    setVatInclusive(draft.vatInclusive);
    setVatRatePctStr(draft.vatRatePctStr);
    setCommissionPctStr(draft.commissionPctStr);
    setCommissionBase(draft.commissionBase);
    setFixedLines(draft.fixedLines);
    setImportFrom(draft.importFrom);
    setImportTo(draft.importTo);
    setCogsLocalPctStr(draft.cogsLocalPctStr);
    setAppPriceMarkupPctStr(draft.appPriceMarkupPctStr);
    setReverseAppSharePctStr(draft.reverseAppSharePctStr);
    setTargetProfitStr(draft.targetProfitStr);
    setReverseGrossStr(draft.reverseGrossStr);
    setAppSharePctStr(draft.appSharePctStr);
    setProbeSalesGrossStr(draft.probeSalesGrossStr);
    setProbePlPreview(null);
    setImporting(false);
    showToast(lang === 'ar' ? 'تم المسح.' : 'Cleared.', 'success');
  }, [activeCompanyId, lang, showToast]);

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
