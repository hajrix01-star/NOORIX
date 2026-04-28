import { useCallback, type DragEvent } from 'react';
import { importFromExcel, exportToExcel } from '../../../utils/exportUtils';
import {
  downloadInvoiceTemplate,
  downloadEmployeeTemplate,
  downloadSalesTemplate,
  EMPLOYEE_EXCEL_EXPORT_OPTS,
  validateInvoiceRows,
  validateEmployeeRows,
  validateSalesRows,
} from '../../../utils/importTemplates';
import { getSaudiToday } from '../../../utils/saudiDate';
import type { EntityConfig, ImportEntityType, ImportValidationResult } from '../types';
import { assertSpreadsheetUploadFile } from '../utils/importExportGuards';
import { runBatchImport } from '../utils/importExportRunImport';
import type { ImportExportModalState } from './useImportExportModalState';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function useImportExportActions(
  base: ImportExportModalState & {
    companyId: string;
    entityType: ImportEntityType;
    exportFetcher?: () => Promise<Record<string, unknown>[]>;
    onImportSuccess?: (count: number) => void;
    cfg: EntityConfig;
    t: TFn;
  },
) {
  const {
    companyId,
    entityType,
    exportFetcher,
    onImportSuccess,
    cfg,
    lookups,
    t,
    setPhase,
    setParsedRows,
    validationResults,
    setValidationResults,
    setImporting,
    setProgress,
    setExporting,
    setDragging,
    fileInputRef,
    abortRef,
    resetImportUi,
    progress,
  } = base;

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        assertSpreadsheetUploadFile(file);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : t('importAlertWrongFile'));
        return;
      }
      setPhase('parsing');
      setValidationResults([]);
      try {
        const rows = (await importFromExcel(file)) as Record<string, unknown>[];
        if (!rows.length) {
          setPhase('idle');
          alert(t('importAlertEmptyRows'));
          return;
        }
        setParsedRows(rows);

        let results: ImportValidationResult[];
        if (entityType === 'invoices') {
          results = validateInvoiceRows(rows, lookups) as ImportValidationResult[];
        } else if (entityType === 'employees') {
          results = validateEmployeeRows(rows) as ImportValidationResult[];
        } else {
          results = validateSalesRows(rows, { vaults: lookups.vaults }) as ImportValidationResult[];
        }
        setValidationResults(results);
        setPhase('validated');
      } catch (err: unknown) {
        setPhase('idle');
        const msg = err instanceof Error ? err.message : t('importErrorUnknown');
        alert(t('importAlertParseFailed', { msg }));
      }
    },
    [entityType, lookups, t, setParsedRows, setPhase, setValidationResults],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      void handleFile(e.dataTransfer.files?.[0]);
    },
    [handleFile, setDragging],
  );

  const handleDownloadTemplate = useCallback(async () => {
    if (entityType === 'invoices') await downloadInvoiceTemplate();
    else if (entityType === 'employees') await downloadEmployeeTemplate();
    else await downloadSalesTemplate(lookups.vaults);
  }, [entityType, lookups.vaults]);

  const handleExport = useCallback(async () => {
    if (!exportFetcher) return;
    setExporting(true);
    try {
      const rows = await exportFetcher();
      if (!rows.length) {
        alert(t('importAlertNoDataToExport'));
        return;
      }
      const stamp = getSaudiToday();
      const baseName = String(cfg.exportFilename || 'export.xlsx').replace(/\.xlsx$/i, '');
      const excelOpts = entityType === 'employees' ? EMPLOYEE_EXCEL_EXPORT_OPTS : undefined;
      await exportToExcel(rows, `${baseName}-${stamp}.xlsx`, excelOpts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      alert(t('importAlertExportFailed', { msg }));
    } finally {
      setExporting(false);
    }
  }, [exportFetcher, cfg.exportFilename, entityType, t, setExporting]);

  const handleImport = useCallback(async () => {
    const validResults = validationResults.filter((r) => r.valid);
    if (!validResults.length) return;

    abortRef.current = false;
    setImporting(true);

    await runBatchImport({
      entityType,
      companyId,
      validResults,
      t,
      abortRef,
      setProgress,
      onImportSuccess,
      setImporting,
      setPhase,
    });
  }, [
    validationResults,
    abortRef,
    setImporting,
    entityType,
    companyId,
    t,
    setProgress,
    onImportSuccess,
    setPhase,
  ]);

  const handleDownloadErrorReport = useCallback(async () => {
    const rows = progress.errors.map((e) => ({ row: e.rowNum, message: e.message }));
    await exportToExcel(rows, 'import-errors.xlsx');
  }, [progress.errors]);

  const handleDownloadWarningsReport = useCallback(async () => {
    const list = progress.warnings || [];
    const rows = list.map((w) => ({ row: w.rowNum, message: w.message }));
    await exportToExcel(rows, 'import-warnings.xlsx');
  }, [progress.warnings]);

  const handleDownloadValidationErrors = useCallback(async () => {
    const rows = validationResults
      .filter((r) => !r.valid || r.warnings.length > 0)
      .flatMap((r) => [
        ...r.errors.map((msg) => ({ row: r.rowNum, level: 'error' as const, message: msg })),
        ...r.warnings.map((msg) => ({ row: r.rowNum, level: 'warning' as const, message: msg })),
      ]);
    await exportToExcel(rows, 'validation-errors.xlsx');
  }, [validationResults]);

  const importAnotherFile = useCallback(() => {
    resetImportUi();
  }, [resetImportUi]);

  return {
    handleFile,
    handleDrop,
    handleDownloadTemplate,
    handleExport,
    handleImport,
    handleDownloadErrorReport,
    handleDownloadWarningsReport,
    handleDownloadValidationErrors,
    importAnotherFile,
  };
}