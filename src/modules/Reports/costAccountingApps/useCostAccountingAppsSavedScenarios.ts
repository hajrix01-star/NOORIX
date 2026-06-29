import { useCallback, useState } from 'react';
import { formatUiDateTime } from '../../../utils/saudiDate';
import {
  buildCostAppsScenarioFile,
  parseCostAppsScenarioJson,
  type CostAppsScenarioRestore,
} from '../costAccountingAppsScenario';
import {
  type CostAppsSavedSlot,
  prependSavedSlot,
  readSavedSlots,
  removeSavedSlotById,
} from '../costAccountingAppsSavedSlots';
import type { CostAppsCommissionBase } from '../costAccountingAppsModel';
import type { FixedLine } from './costAccountingAppsScreenUtils';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;
type ToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

export function useCostAccountingAppsSavedScenarios(params: {
  activeCompanyId: string | null | undefined;
  lang: string;
  t: TranslateFn;
  showToast: ToastFn;
  companyName: string;
  applyScenarioRestore: (restore: CostAppsScenarioRestore) => void;
  snapshot: {
    grossAppStr: string;
    grossCashStr: string;
    grossBankStr: string;
    vatInclusive: boolean;
    vatRatePctStr: string;
    commissionPctStr: string;
    commissionBase: CostAppsCommissionBase;
    fixedLines: FixedLine[];
    salaryStr: string;
    importFrom: string;
    importTo: string;
    targetProfitStr: string;
    reverseGrossStr: string;
    appSharePctStr: string;
    reverseAppSharePctStr: string;
    probeSalesGrossStr: string;
    cogsLocalPctStr: string;
    appPriceMarkupPctStr: string;
  };
}) {
  const { activeCompanyId, lang, t, showToast, companyName, applyScenarioRestore, snapshot } = params;
  const [savedSlots, setSavedSlots] = useState<CostAppsSavedSlot[]>([]);
  const [previewSlot, setPreviewSlot] = useState<CostAppsSavedSlot | null>(null);

  const reloadSavedSlots = useCallback(() => {
    setSavedSlots(activeCompanyId ? readSavedSlots(activeCompanyId) : []);
    setPreviewSlot(null);
  }, [activeCompanyId]);

  const handleSaveCalculatorSlot = useCallback(() => {
    if (!activeCompanyId) {
      showToast(t('pleaseSelectCompany'), 'error');
      return;
    }
    const suggested = formatUiDateTime(new Date(), lang, 'compact');
    const input = typeof window !== 'undefined' ? window.prompt(String(t('reportCostAppsSaveSlotPrompt')), suggested) : null;
    if (input === null) return;
    const labelTrim = input.trim();
    const json = buildCostAppsScenarioFile({
      name: labelTrim || companyName || undefined,
      ...snapshot,
    });
    const slot: CostAppsSavedSlot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      savedAt: new Date().toISOString(),
      label: labelTrim || t('reportCostAppsSavedUnnamed'),
      scenarioJson: json,
    };
    setSavedSlots(prependSavedSlot(activeCompanyId, slot));
    showToast(t('reportCostAppsSaveSlotOk'), 'success');
  }, [activeCompanyId, companyName, lang, showToast, snapshot, t]);

  const handleImportSavedSlot = useCallback(
    (slot: CostAppsSavedSlot) => {
      if (typeof window !== 'undefined' && !window.confirm(t('reportCostAppsSavedImportConfirm'))) return;
      const res = parseCostAppsScenarioJson(slot.scenarioJson);
      if (!res.ok) {
        const key =
          res.error === 'invalid_json'
            ? 'reportCostAppsScenarioErrInvalidJson'
            : res.error === 'bad_version'
              ? 'reportCostAppsScenarioErrBadVersion'
              : res.error === 'not_object'
                ? 'reportCostAppsScenarioErrNotObject'
                : res.error === 'empty_scenario'
                  ? 'reportCostAppsScenarioErrEmpty'
                  : 'reportCostAppsScenarioErrGeneric';
        showToast(t(key), 'error');
        return;
      }
      applyScenarioRestore(res.restore);
      showToast(t('reportCostAppsScenarioImportOk'), 'success');
      setPreviewSlot(null);
    },
    [applyScenarioRestore, showToast, t],
  );

  const handleDeleteSavedSlot = useCallback(
    (slotId: string) => {
      if (!activeCompanyId) return;
      if (typeof window !== 'undefined' && !window.confirm(t('reportCostAppsSavedDeleteConfirm'))) return;
      setSavedSlots(removeSavedSlotById(activeCompanyId, slotId));
      setPreviewSlot((p) => (p?.id === slotId ? null : p));
      showToast(t('reportCostAppsSavedDeleteOk'), 'success');
    },
    [activeCompanyId, showToast, t],
  );

  return {
    savedSlots,
    previewSlot,
    setPreviewSlot,
    reloadSavedSlots,
    handleSaveCalculatorSlot,
    handleImportSavedSlot,
    handleDeleteSavedSlot,
  };
}
