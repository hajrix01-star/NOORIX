import React, { useMemo } from 'react';
import type { ImportEntityType, ImportValidationResult } from '../types';
import type { ImportExportStyles } from '../types';
import { S as defaultStyles } from '../constants';
import { ImportPhaseSteps } from './ImportPhaseSteps';
import { TemplateDownloadPanel } from './TemplateDownloadPanel';
import { ImportUploadSection } from './ImportUploadSection';
import { ImportValidationSection } from './ImportValidationSection';
import { ImportProgressSection } from './ImportProgressSection';
import { ImportResultPanel } from './ImportResultPanel';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function ImportPanel({
  entityType,
  phase,
  importing,
  lookupsLoading,
  parsedRows,
  validationResults,
  progress,
  showAllErrors,
  setShowAllErrors,
  dragging,
  setDragging,
  fileInputRef,
  handleFile,
  handleDrop,
  handleDownloadTemplate,
  handleImport,
  handleDownloadValidationErrors,
  handleDownloadErrorReport,
  handleDownloadWarningsReport,
  importAnotherFile,
  onClose,
  onAbortImport,
  S = defaultStyles,
  t,
}: {
  entityType: ImportEntityType;
  phase: string;
  importing: boolean;
  lookupsLoading: boolean;
  parsedRows: Record<string, unknown>[];
  validationResults: ImportValidationResult[];
  progress: import('../types').ImportProgressState;
  showAllErrors: boolean;
  setShowAllErrors: (v: boolean) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFile: (f: File | undefined) => void;
  handleDrop: React.DragEventHandler<HTMLDivElement>;
  handleDownloadTemplate: () => void;
  handleImport: () => void;
  handleDownloadValidationErrors: () => void | Promise<void>;
  handleDownloadErrorReport: () => void | Promise<void>;
  handleDownloadWarningsReport: () => void | Promise<void>;
  importAnotherFile: () => void;
  onClose: () => void;
  onAbortImport: () => void;
  S?: ImportExportStyles;
  t: TFn;
}) {
  const validCount = useMemo(() => validationResults.filter((r) => r.valid).length, [validationResults]);
  const errorCount = useMemo(() => validationResults.filter((r) => !r.valid).length, [validationResults]);
  const warnCount = useMemo(
    () => validationResults.filter((r) => r.valid && r.warnings.length > 0).length,
    [validationResults],
  );

  const issueRows = useMemo(
    () => validationResults.filter((r) => !r.valid || r.warnings.length > 0),
    [validationResults],
  );

  const errorsToShow = useMemo(
    () => (showAllErrors ? issueRows : issueRows.slice(0, 10)),
    [issueRows, showAllErrors],
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <ImportPhaseSteps phase={phase} importing={importing} t={t} />

      {phase !== 'done' && !importing && (
        <TemplateDownloadPanel
          entityType={entityType}
          lookupsLoading={lookupsLoading}
          onDownloadTemplate={handleDownloadTemplate}
          t={t}
        />
      )}

      {phase !== 'done' && !importing && (
        <ImportUploadSection
          phase={phase}
          dragging={dragging}
          setDragging={setDragging}
          onDrop={handleDrop}
          onPickFile={handleFile}
          fileInputRef={fileInputRef}
          parsedRowsCount={parsedRows.length}
          onChooseOtherFile={() => fileInputRef.current?.click()}
          S={S}
          t={t}
        />
      )}

      {phase === 'validated' && !importing && (
        <ImportValidationSection
          entityType={entityType}
          validationResults={validationResults}
          parsedRows={parsedRows}
          validCount={validCount}
          errorCount={errorCount}
          warnCount={warnCount}
          showAllErrors={showAllErrors}
          setShowAllErrors={setShowAllErrors}
          errorsToShow={errorsToShow}
          onImport={handleImport}
          onDownloadValidationErrors={() => void handleDownloadValidationErrors()}
          t={t}
        />
      )}

      {importing && (
        <ImportProgressSection progress={progress} onAbort={onAbortImport} t={t} />
      )}

      {phase === 'done' && !importing && (
        <ImportResultPanel
          progress={progress}
          onClose={onClose}
          onImportAnother={importAnotherFile}
          onDownloadErrors={() => void handleDownloadErrorReport()}
          onDownloadWarnings={() => void handleDownloadWarningsReport()}
          t={t}
        />
      )}
    </div>
  );
}
