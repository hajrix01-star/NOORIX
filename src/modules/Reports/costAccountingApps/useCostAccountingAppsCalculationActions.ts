import { useCallback } from 'react';
import Decimal from 'decimal.js';
import {
  computeCostAppsPl,
  reverseGrossTotalForTargetProfit,
  type CostAppsCommissionBase,
} from '../costAccountingAppsModel';
import { parseMoneyInput, splitGrossByAppShare } from './costAccountingAppsScreenUtils';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

type ProbePreview = {
  netProfit: Decimal;
  netSales: Decimal;
  commission: Decimal;
  grossTotal: Decimal;
};

type UseCostAppsCalculationActionsParams = {
  t: TranslateFn;
  showToast: (message: string, variant?: 'success' | 'error' | 'info' | 'warning') => void;
  fixedTotal: Decimal;
  salaryTotal: Decimal;
  grossCash: Decimal;
  grossBank: Decimal;
  currentGrossTotal: Decimal;
  vatInclusive: boolean;
  vatRateDec: Decimal;
  commissionPctDec: Decimal;
  commissionBase: CostAppsCommissionBase;
  cogsLocalPctStr: string;
  appPriceMarkupPctStr: string;
  reverseAppSharePctStr: string;
  targetProfitStr: string;
  reverseGrossStr: string;
  probeSalesGrossStr: string;
  appSharePctStr: string;
  setReverseGrossStr: (value: string) => void;
  setProbePlPreview: (value: ProbePreview | null) => void;
  setGrossAppStr: (value: string) => void;
  setGrossCashStr: (value: string) => void;
  setGrossBankStr: (value: string) => void;
};

export function useCostAccountingAppsCalculationActions(params: UseCostAppsCalculationActionsParams) {
  const {
    t,
    showToast,
    fixedTotal,
    salaryTotal,
    grossCash,
    grossBank,
    currentGrossTotal,
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
  } = params;

  const applySplitToInputs = useCallback(
    (grossTotal: Decimal, appShare: Decimal): boolean => {
      const split = splitGrossByAppShare({
        grossTotal,
        appShare,
        currentCash: grossCash,
        currentBank: grossBank,
      });
      if (!split.ok) return false;
      setGrossAppStr(split.grossApp.toFixed(2));
      setGrossCashStr(split.grossCash.toFixed(2));
      setGrossBankStr(split.grossBank.toFixed(2));
      return true;
    },
    [grossBank, grossCash, setGrossAppStr, setGrossBankStr, setGrossCashStr],
  );

  const parseAppShare = useCallback((): Decimal | null => {
    const alpha = parseMoneyInput(reverseAppSharePctStr).div(100);
    return alpha.lt(0) || alpha.gt(1) ? null : alpha;
  }, [reverseAppSharePctStr]);

  const handleReverse = useCallback(() => {
    const alpha = parseAppShare();
    if (!alpha) {
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
    parseAppShare,
    salaryTotal,
    setReverseGrossStr,
    showToast,
    t,
    targetProfitStr,
    vatInclusive,
    vatRateDec,
  ]);

  const handleProbeProfit = useCallback(() => {
    const grossTotal = parseMoneyInput(probeSalesGrossStr);
    const alpha = parseAppShare();
    if (grossTotal.lte(0) || !alpha) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      setProbePlPreview(null);
      return;
    }
    const split = splitGrossByAppShare({
      grossTotal,
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
    parseAppShare,
    probeSalesGrossStr,
    salaryTotal,
    setProbePlPreview,
    showToast,
    t,
    vatInclusive,
    vatRateDec,
  ]);

  const handleApplyProbeToFields = useCallback(() => {
    const grossTotal = parseMoneyInput(probeSalesGrossStr);
    const alpha = parseAppShare();
    if (grossTotal.lte(0) || !alpha || !applySplitToInputs(grossTotal, alpha)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    showToast(t('reportCostAppsImportOk'), 'success');
  }, [applySplitToInputs, parseAppShare, probeSalesGrossStr, showToast, t]);

  const handleApplyReverse = useCallback(() => {
    const grossTotal = parseMoneyInput(reverseGrossStr);
    const alpha = parseAppShare();
    if (grossTotal.lte(0) || !alpha || !applySplitToInputs(grossTotal, alpha)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    showToast(t('reportCostAppsImportOk'), 'success');
  }, [applySplitToInputs, parseAppShare, reverseGrossStr, showToast, t]);

  const handleApplyAppShare = useCallback(() => {
    if (currentGrossTotal.lte(0)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    const pct = parseMoneyInput(appSharePctStr);
    if (pct.lt(0) || pct.gt(100) || !applySplitToInputs(currentGrossTotal, pct.div(100))) {
      showToast(t('reportCostAppsReverseErr'), 'error');
    }
  }, [appSharePctStr, applySplitToInputs, currentGrossTotal, showToast, t]);

  return {
    handleReverse,
    handleProbeProfit,
    handleApplyProbeToFields,
    handleApplyReverse,
    handleApplyAppShare,
  };
}
