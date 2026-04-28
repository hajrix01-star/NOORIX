import React from 'react';
import { AdaptiveSheet } from '../../ui';
import { useTranslation } from '../../i18n/useTranslation';
import { LoadingState } from '../states/LoadingState';
import { ENTITY_CONFIG } from './constants';
import type { ImportExportModalProps } from './types';
import { useImportExportModalState } from './hooks/useImportExportModalState';
import { useImportExportActions } from './hooks/useImportExportActions';
import { ImportExportTabs } from './components/ImportExportTabs';
import { ExportPanel } from './components/ExportPanel';
import { ImportPanel } from './components/ImportPanel';

export default function ImportExportModal({
  isOpen,
  onClose,
  entityType,
  companyId,
  exportFetcher,
  onImportSuccess,
}: ImportExportModalProps) {
  const { t } = useTranslation();
  const cfg = ENTITY_CONFIG[entityType] ?? ENTITY_CONFIG.invoices;
  const entityLabel = t(cfg.labelKey);

  const modalState = useImportExportModalState({
    isOpen,
    companyId,
    entityType,
    exportFetcher,
    t,
  });

  const actions = useImportExportActions({
    ...modalState,
    companyId,
    entityType,
    exportFetcher,
    onImportSuccess,
    cfg,
    t,
  });

  return (
    <AdaptiveSheet
      open={isOpen}
      onClose={() => {
        if (!modalState.importing) onClose();
      }}
      title={t('importExportSheetTitle', { entity: entityLabel })}
      size="xl"
      side="start"
      className="import-export-drawer"
      closeOnBackdrop={!modalState.importing}
    >
      {modalState.lookupsLoading ? (
        <LoadingState className="mb-3 justify-start text-[12px]" message={t('importLookupsLoading')} />
      ) : null}

      <ImportExportTabs items={modalState.sheetTabItems} value={modalState.activeTab} onChange={modalState.setActiveTab}>
        {modalState.activeTab === 'export' && (
          <ExportPanel entityType={entityType} t={t} exporting={modalState.exporting} onExport={actions.handleExport} />
        )}

        {modalState.activeTab === 'import' && (
          <ImportPanel
            entityType={entityType}
            phase={modalState.phase}
            importing={modalState.importing}
            lookupsLoading={modalState.lookupsLoading}
            parsedRows={modalState.parsedRows}
            validationResults={modalState.validationResults}
            progress={modalState.progress}
            showAllErrors={modalState.showAllErrors}
            setShowAllErrors={modalState.setShowAllErrors}
            dragging={modalState.dragging}
            setDragging={modalState.setDragging}
            fileInputRef={modalState.fileInputRef}
            handleFile={actions.handleFile}
            handleDrop={actions.handleDrop}
            handleDownloadTemplate={actions.handleDownloadTemplate}
            handleImport={actions.handleImport}
            handleDownloadValidationErrors={actions.handleDownloadValidationErrors}
            handleDownloadErrorReport={actions.handleDownloadErrorReport}
            handleDownloadWarningsReport={actions.handleDownloadWarningsReport}
            importAnotherFile={actions.importAnotherFile}
            onClose={onClose}
            onAbortImport={() => {
              modalState.abortRef.current = true;
            }}
            t={t}
          />
        )}
      </ImportExportTabs>
    </AdaptiveSheet>
  );
}
