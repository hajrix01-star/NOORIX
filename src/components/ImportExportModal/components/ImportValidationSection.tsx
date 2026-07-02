import React from 'react';
import { Button } from '../../../ui';
import type { ImportEntityType } from '../types';
import type { ImportValidationResult } from '../types';
import { ImportExportStatBadge } from './ImportExportProgressBar';
import { EmployeeImportPreviewTable } from './EmployeeImportPreviewTable';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function ImportValidationSection({
  entityType,
  validationResults,
  parsedRows,
  validCount,
  errorCount,
  warnCount,
  showAllErrors,
  setShowAllErrors,
  errorsToShow,
  onImport,
  onDownloadValidationErrors,
  t,
}: {
  entityType: ImportEntityType;
  validationResults: ImportValidationResult[];
  parsedRows: Record<string, unknown>[];
  validCount: number;
  errorCount: number;
  warnCount: number;
  showAllErrors: boolean;
  setShowAllErrors: (v: boolean) => void;
  errorsToShow: ImportValidationResult[];
  onImport: () => void;
  onDownloadValidationErrors: () => void;
  t: TFn;
}) {
  const issueRows = validationResults.filter((r) => !r.valid || r.warnings.length > 0);
  return (
    <div className="rounded-xl border border-noorix-border p-4 flex flex-col gap-3">
      <p className="text-[13px] font-bold text-noorix-muted uppercase tracking-[0.05em] mb-2">{t('importStep3Title')}</p>
      <div className="flex flex-wrap gap-3">
        <ImportExportStatBadge count={validCount} label={t('importStatValidRows')} color="#16a34a" />
        {errorCount > 0 && (
          <ImportExportStatBadge count={errorCount} label={t('importStatRowErrors')} color="var(--noorix-accent-red)" />
        )}
        {warnCount > 0 && (
          <ImportExportStatBadge count={warnCount} label={t('importStatWarnings')} color="#f59e0b" />
        )}
      </div>

      {entityType === 'employees' && validationResults.length > 0 && (
        <EmployeeImportPreviewTable validationResults={validationResults} parsedRows={parsedRows} t={t} />
      )}

      {(errorCount > 0 || warnCount > 0) && (
        <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
          {errorsToShow.map((r) => (
            <div key={r.rowNum}>
              {r.errors.map((msg, j) => (
                <div
                  key={j}
                  className="grid gap-2 rounded-lg text-[13px] grid-cols-[56px_1fr] items-start py-1.5 px-2.5 bg-[var(--noorix-red-7)]"
                >
                  <span className="font-bold text-noorix-red">
                    {t('importValidationRowPrefix')} {r.rowNum}
                  </span>
                  <span className="text-noorix-red">{msg}</span>
                </div>
              ))}
              {r.warnings.map((msg, j) => (
                <div
                  key={`w${j}`}
                  className="grid gap-2 rounded-lg text-[12px] grid-cols-[56px_1fr] items-start py-[5px] px-[10px] bg-[var(--noorix-yellow-7)]"
                >
                  <span className="font-bold text-noorix-amber">
                    {t('importValidationRowPrefix')} {r.rowNum}
                  </span>
                  <span className="text-noorix-amber">{msg}</span>
                </div>
              ))}
            </div>
          ))}
          {issueRows.length > 10 && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAllErrors(!showAllErrors)}>
              {showAllErrors
                ? t('importShowLess')
                : t('importShowAll', { count: issueRows.length })}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="self-start" onClick={onDownloadValidationErrors}>
            {t('importDownloadValidationReport')}
          </Button>
        </div>
      )}

      {validCount === 0 ? (
        <div className="text-[14px] text-noorix-red font-semibold">{t('importNoValidRows')}</div>
      ) : (
        <Button variant="primary" className="self-start" onClick={onImport}>
          {t('importStartImport', { valid: validCount })}
          {errorCount > 0 ? t('importStartImportSkipErrors', { count: errorCount }) : ''}
        </Button>
      )}
    </div>
  );
}
