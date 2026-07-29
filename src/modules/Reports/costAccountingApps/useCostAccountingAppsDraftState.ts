import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type Decimal from 'decimal.js';
import type { CostAppsCommissionBase } from '../costAccountingAppsModel';
import type { CostAppsScenarioRestore } from '../costAccountingAppsScenario';
import {
  defaultCostAppsDraftValues,
  draftKey,
  normalizeFixedLines,
  parseCostAppsDraft,
  type FixedLine,
} from './costAccountingAppsScreenUtils';

type UseCostAppsDraftStateParams = {
  activeCompanyId?: string | null;
};

export function useCostAccountingAppsDraftState({ activeCompanyId }: UseCostAppsDraftStateParams) {
  const [grossAppStr, setGrossAppStr] = useState('');
  const [grossCashStr, setGrossCashStr] = useState('');
  const [grossBankStr, setGrossBankStr] = useState('');
  const [vatInclusive, setVatInclusive] = useState(true);
  const [vatRatePctStr, setVatRatePctStr] = useState(() => defaultCostAppsDraftValues().vatRatePctStr);
  const [commissionPctStr, setCommissionPctStr] = useState('25');
  const [commissionBase, setCommissionBase] = useState<CostAppsCommissionBase>('gross');
  const [fixedLines, setFixedLines] = useState<FixedLine[]>(() => defaultCostAppsDraftValues().fixedLines);
  const [defaultImportFrom, defaultImportTo] = useMemo(() => {
    const draft = defaultCostAppsDraftValues();
    return [draft.importFrom, draft.importTo];
  }, []);
  const [importFrom, setImportFrom] = useState(defaultImportFrom);
  const [importTo, setImportTo] = useState(defaultImportTo);
  const [salaryStr, setSalaryStr] = useState('');
  const [targetProfitStr, setTargetProfitStr] = useState('20000');
  const [reverseGrossStr, setReverseGrossStr] = useState('');
  const [appSharePctStr, setAppSharePctStr] = useState('');
  const [cogsLocalPctStr, setCogsLocalPctStr] = useState('0');
  const [appPriceMarkupPctStr, setAppPriceMarkupPctStr] = useState('0');
  const [reverseAppSharePctStr, setReverseAppSharePctStr] = useState('30');
  const [probeSalesGrossStr, setProbeSalesGrossStr] = useState('');
  const [probePlPreview, setProbePlPreview] = useState<{
    netProfit: Decimal;
    netSales: Decimal;
    commission: Decimal;
    grossTotal: Decimal;
  } | null>(null);

  const applyDraft = useCallback((draft: ReturnType<typeof defaultCostAppsDraftValues>) => {
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
  }, []);

  useLayoutEffect(() => {
    if (!activeCompanyId) return;
    applyDraft(parseCostAppsDraft(localStorage.getItem(draftKey(activeCompanyId))));
  }, [activeCompanyId, applyDraft]);

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
      // Local drafts are a convenience; storage failures should not block the report.
    }
  }, [
    activeCompanyId,
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
    probeSalesGrossStr,
    reverseAppSharePctStr,
    reverseGrossStr,
    salaryStr,
    targetProfitStr,
    vatInclusive,
    vatRatePctStr,
  ]);

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
      probeSalesGrossStr,
      reverseAppSharePctStr,
      reverseGrossStr,
      salaryStr,
      targetProfitStr,
      vatInclusive,
      vatRatePctStr,
    ],
  );

  const resetDraftState = useCallback(() => {
    if (activeCompanyId) localStorage.removeItem(draftKey(activeCompanyId));
    applyDraft(defaultCostAppsDraftValues());
  }, [activeCompanyId, applyDraft]);

  return {
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
  };
}
