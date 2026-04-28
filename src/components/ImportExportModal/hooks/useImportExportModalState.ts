import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, getPaymentVaults, getSalesChannels } from '../../../services/api';
import { pickApiList } from '../utils/importExportMappers';
import type { ImportEntityType, LookupsState, ImportProgressState, ImportValidationResult } from '../types';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

const initialProgress: ImportProgressState = {
  current: 0,
  total: 0,
  succeeded: 0,
  failed: 0,
  errors: [],
  warnings: [],
};

export function useImportExportModalState({
  isOpen,
  companyId,
  entityType,
  exportFetcher,
  t,
}: {
  isOpen: boolean;
  companyId: string;
  entityType: ImportEntityType;
  exportFetcher?: () => Promise<Record<string, unknown>[]>;
  t: TFn;
}) {
  const [activeTab, setActiveTab] = useState('import');

  const sheetTabItems = useMemo(() => {
    const items: { id: string; label: string }[] = [{ id: 'import', label: t('importDrawerTab') }];
    if (exportFetcher) items.push({ id: 'export', label: t('exportDrawerTab') });
    return items;
  }, [exportFetcher, t]);

  const [lookups, setLookups] = useState<LookupsState>({
    suppliers: [],
    vaults: [],
    categories: [],
    expenseLines: [],
  });
  const [lookupsLoading, setLookupsLoading] = useState(false);

  const [phase, setPhase] = useState('idle');
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [validationResults, setValidationResults] = useState<ImportValidationResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgressState>(initialProgress);
  const [showAllErrors, setShowAllErrors] = useState(false);

  const [exporting, setExporting] = useState(false);

  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !companyId) return;
    setLookupsLoading(true);
    const vaultPromise =
      entityType === 'sales'
        ? getSalesChannels(companyId).catch(() => ({}))
        : getPaymentVaults(companyId).catch(() => ({}));
    const promises: Promise<unknown>[] = [vaultPromise];
    if (entityType === 'invoices') {
      promises.push(
        apiGet('/api/v1/suppliers', { companyId, pageSize: 500 }).catch(() => ({})),
        apiGet('/api/v1/categories', { companyId }).catch(() => []),
        apiGet('/api/v1/expense-lines', { companyId, includeInactive: false }).catch(() => []),
      );
    }
    Promise.all(promises)
      .then((results: unknown[]) => {
        const vaultsRes = results[0];
        const suppliersRes = results[1];
        const categoriesRes = results[2];
        const expLinesRes = results[3];
        setLookups({
          vaults: pickApiList(vaultsRes),
          suppliers: pickApiList(suppliersRes),
          categories: pickApiList(categoriesRes),
          expenseLines: pickApiList(expLinesRes),
        });
      })
      .finally(() => setLookupsLoading(false));
  }, [isOpen, companyId, entityType]);

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setParsedRows([]);
      setValidationResults([]);
      setImporting(false);
      setProgress(initialProgress);
      setShowAllErrors(false);
      abortRef.current = false;
      setActiveTab('import');
    }
  }, [isOpen]);

  const resetImportUi = useCallback(() => {
    setPhase('idle');
    setParsedRows([]);
    setValidationResults([]);
    setProgress(initialProgress);
  }, []);

  return {
    activeTab,
    setActiveTab,
    sheetTabItems,
    lookups,
    lookupsLoading,
    phase,
    setPhase,
    parsedRows,
    setParsedRows,
    validationResults,
    setValidationResults,
    importing,
    setImporting,
    progress,
    setProgress,
    showAllErrors,
    setShowAllErrors,
    exporting,
    setExporting,
    dragging,
    setDragging,
    fileInputRef,
    abortRef,
    resetImportUi,
  };
}

export type ImportExportModalState = ReturnType<typeof useImportExportModalState>;