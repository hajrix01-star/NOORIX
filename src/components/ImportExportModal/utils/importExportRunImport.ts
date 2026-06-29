import type { MutableRefObject } from 'react';
import {
  createInvoice,
  createEmployeesBatch,
  createDailySalesSummary,
  throwIfApiFailed,
} from '../../../services/api';
import type { ApiParsedResult } from '../../../types/api/http';
import { appendEmployeesBatchErrors, appendEmployeesBatchWarnings } from './importExportMappers';
import type { ImportEntityType, ImportProgressRow, ImportProgressState, ImportValidationResult } from '../types';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/**
 * نفس تسلسل الاستيراد الجماعي السابق (دُفعات، تقدم، أخطاء).
 */
export async function runBatchImport({
  entityType,
  companyId,
  validResults,
  t,
  abortRef,
  setProgress,
  onImportSuccess,
  setImporting,
  setPhase,
}: {
  entityType: ImportEntityType;
  companyId: string;
  validResults: ImportValidationResult[];
  t: TFn;
  abortRef: MutableRefObject<boolean>;
  setProgress: (p: ImportProgressState | ((prev: ImportProgressState) => ImportProgressState)) => void;
  onImportSuccess?: (count: number) => void;
  setImporting: (v: boolean) => void;
  setPhase: (p: string) => void;
}): Promise<void> {
  const total = validResults.length;
  setProgress({ current: 0, total, succeeded: 0, failed: 0, errors: [], warnings: [] });

  let succeeded = 0;
  let failed = 0;
  const errors: ImportProgressRow[] = [];
  const importWarnings: ImportProgressRow[] = [];

  if (entityType === 'invoices') {
    const batchSize = 8;
    for (let i = 0; i < validResults.length; i += batchSize) {
      if (abortRef.current) break;
      const slice = validResults.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        slice.map((r) => createInvoice({ ...(r.payload as Record<string, unknown>), companyId })),
      );
      results.forEach((res, idx) => {
        const rowNum = slice[idx].rowNum;
        if (res.status === 'fulfilled') {
          try {
            throwIfApiFailed(res.value, t('importErrorUnknown'));
            succeeded++;
          } catch (e: unknown) {
            failed++;
            errors.push({
              rowNum,
              message: e instanceof Error ? e.message : t('importErrorUnknown'),
            });
          }
        } else {
          failed++;
          const reasonMsg =
            res.reason instanceof Error ? res.reason.message : t('importErrorUnknown');
          errors.push({ rowNum, message: reasonMsg });
        }
      });
      setProgress({ current: i + slice.length, total, succeeded, failed, errors: [...errors], warnings: [...importWarnings] });
    }
  } else if (entityType === 'employees') {
    const batchSize = 50;
    for (let i = 0; i < validResults.length; i += batchSize) {
      if (abortRef.current) break;
      const slice = validResults.slice(i, i + batchSize);
      let res: ApiParsedResult | { success: false; error?: string };
      try {
        res = await createEmployeesBatch({
          companyId,
          items: slice.map((r) => ({ ...(r.payload as Record<string, unknown>), companyId })),
        });
      } catch (err: unknown) {
        res = {
          success: false,
          error: err instanceof Error ? err.message : t('importErrorSaveFailed'),
        };
      }
      if (res?.success) {
        const br = (res.data || {}) as {
          created?: number;
          failed?: number;
          errors?: unknown;
          warnings?: unknown;
        };
        succeeded += Number(br.created) || 0;
        failed += Number(br.failed) || 0;
        appendEmployeesBatchErrors(br.errors, slice, errors, t('importErrorUnknown'));
        appendEmployeesBatchWarnings(br.warnings, slice, importWarnings);
      } else {
        for (const r of slice) {
          let r2: ApiParsedResult | undefined;
          try {
            r2 = await createEmployeesBatch({ companyId, items: [{ ...(r.payload as Record<string, unknown>), companyId }] });
          } catch (e2: unknown) {
            failed += 1;
            errors.push({
              rowNum: r.rowNum,
              message: e2 instanceof Error ? e2.message : t('importErrorUnknown'),
            });
            continue;
          }
          if (!r2?.success) {
            failed += 1;
            errors.push({ rowNum: r.rowNum, message: r2?.error || res?.error || t('importErrorBatchFailed') });
          } else {
            const br = (r2.data || {}) as {
              created?: number;
              failed?: number;
              errors?: unknown;
              warnings?: unknown;
            };
            succeeded += Number(br.created) || 0;
            failed += Number(br.failed) || 0;
            appendEmployeesBatchErrors(br.errors, [r], errors, t('importErrorUnknown'));
            appendEmployeesBatchWarnings(br.warnings, [r], importWarnings);
          }
        }
      }
      setProgress({ current: i + slice.length, total, succeeded, failed, errors: [...errors], warnings: [...importWarnings] });
    }
  } else if (entityType === 'sales') {
    for (let i = 0; i < validResults.length; i++) {
      if (abortRef.current) break;
      const r = validResults[i];
      try {
        const sumRes = await createDailySalesSummary({ ...(r.payload as Record<string, unknown>), companyId });
        throwIfApiFailed(sumRes, t('importErrorUnknown'));
        succeeded++;
      } catch (err: unknown) {
        failed++;
        errors.push({
          rowNum: r.rowNum,
          message: err instanceof Error ? err.message : t('importErrorUnknown'),
        });
      }
      setProgress({ current: i + 1, total, succeeded, failed, errors: [...errors], warnings: [...importWarnings] });
    }
  }

  setImporting(false);
  setPhase('done');
  if (succeeded > 0 && typeof onImportSuccess === 'function') onImportSuccess(succeeded);
}
