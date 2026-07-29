import { Button, AdaptiveSheet } from '../../../../ui';
import type {
  BackupImportReport,
  BackupReportModal,
  TranslationFn,
} from '../../settingsTypes';
import { formatBackupDate, scopeLabel } from './backupTabHelpers';
import { BackupCountsGrid } from './BackupCountsGrid';

type BackupRestoreReportSheetProps = {
  t: TranslationFn;
  lang: string;
  isAr: boolean;
  reportModal: BackupReportModal | null;
  setReportModal: (value: BackupReportModal | null) => void;
};

type BackupImportReportSheetProps = {
  t: TranslationFn;
  lang: string;
  importReportModal: BackupImportReport | null;
  setImportReportModal: (value: BackupImportReport | null) => void;
};

export function BackupRestoreReportSheet({
  t,
  lang,
  isAr,
  reportModal,
  setReportModal,
}: BackupRestoreReportSheetProps) {
  return (
    <AdaptiveSheet
      open={!!reportModal}
      onClose={() => setReportModal(null)}
      title={t('backupRestoreReport')}
      size="md"
      side="start"
      className="backup-restore-report-drawer"
    >
      {reportModal && (
        <>
          <p className="text-[13px] text-noorix-muted m-0 mb-4 leading-[1.6]">
            {isAr ? reportModal.payload?.messageAr : reportModal.payload?.messageEn || reportModal.payload?.messageAr}
          </p>

          <div className="grid gap-3.5">
            <div>
              <div className="text-[12px] font-extrabold mb-2 text-noorix-muted">
                {t('backupReportSummary')}
              </div>
              <div className="text-[13px] leading-[1.85]">
                <div>
                  <strong>{t('backupReportJobId')}:</strong>{' '}
                  <code className="text-[12px]">{reportModal.payload?.jobId}</code>
                </div>
                <div>
                  <strong>{t('backupReportScope')}:</strong> {scopeLabel(reportModal.payload?.scope, t)}
                </div>
              </div>
            </div>

            {reportModal.payload?.meta && (
              <div>
                <div className="text-[12px] font-extrabold mb-2 text-noorix-muted">
                  {t('backupReportMeta')}
                </div>
                <div className="text-[13px] leading-[1.85]">
                  <div>
                    <strong>{t('backupReportExportedAt')}:</strong>{' '}
                    {formatBackupDate(reportModal.payload.meta.exportedAt)}
                  </div>
                  {reportModal.payload.meta.version != null && (
                    <div>
                      <strong>{t('backupReportVersion')}:</strong> {reportModal.payload.meta.version}
                    </div>
                  )}
                  {reportModal.payload.meta.companyId && (
                    <div>
                      <strong>{t('backupReportOriginalCompany')}:</strong>{' '}
                      <code className="text-[11px]">{reportModal.payload.meta.companyId}</code>
                    </div>
                  )}
                </div>
              </div>
            )}

            {reportModal.payload?.integrity && (
              <div>
                <div className="text-[12px] font-extrabold mb-2 text-noorix-muted">
                  {t('backupReportIntegrity')}
                </div>
                <div className="text-[12px] leading-[1.75] break-all">
                  {reportModal.payload.integrity.sizeBytes != null && (
                    <div>
                      <strong>{t('backupReportSizeBytes')}:</strong>{' '}
                      {String(reportModal.payload.integrity.sizeBytes)}
                    </div>
                  )}
                  {reportModal.payload.integrity.contentHash && (
                    <div>
                      <strong>{t('backupReportHashLabel')}:</strong> {reportModal.payload.integrity.contentHash}
                    </div>
                  )}
                </div>
              </div>
            )}

            {reportModal.payload?.counts && (
              <BackupCountsGrid counts={reportModal.payload.counts} t={t} lang={lang} />
            )}

            <details className="text-[12px]">
              <summary className="cursor-pointer font-bold">{t('backupReportRawJson')}</summary>
              <pre className="text-[11px] bg-noorix-bg-muted p-3 overflow-auto nx-ltr mt-2.5 rounded-lg max-h-[220px] text-left">
                {JSON.stringify(reportModal.payload, null, 2)}
              </pre>
            </details>
          </div>

          <div className="flex justify-stretch sm:justify-end mt-[18px]">
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="w-full min-h-[44px] sm:w-auto"
              onClick={() => setReportModal(null)}
            >
              {t('close')}
            </Button>
          </div>
        </>
      )}
    </AdaptiveSheet>
  );
}

export function BackupImportReportSheet({
  t,
  lang,
  importReportModal,
  setImportReportModal,
}: BackupImportReportSheetProps) {
  return (
    <AdaptiveSheet
      open={!!importReportModal}
      onClose={() => setImportReportModal(null)}
      title={t('backupImportReportTitle')}
      size="md"
      side="start"
      className="backup-import-report-drawer"
    >
      {importReportModal && (
        <>
          <p className="text-[13px] text-noorix-muted m-0 mb-4 leading-[1.6]">
            {t('backupImportOk')}
          </p>

          <div className="grid gap-3.5">
            <div>
              <div className="text-[12px] font-extrabold mb-2 text-noorix-muted">
                {t('backupReportNewCompany')}
              </div>
              <div className="text-[13px] leading-[1.85]">
                <div>
                  <strong>{t('backupReportNameAr')}:</strong> {importReportModal.nameAr}
                </div>
                {importReportModal.nameEn && (
                  <div>
                    <strong>{t('backupReportNameEn')}:</strong> {importReportModal.nameEn}
                  </div>
                )}
                <div>
                  <strong>{t('backupReportNewId')}:</strong>{' '}
                  <code className="text-[11px]">{importReportModal.newCompanyId}</code>
                </div>
                {importReportModal.summary?.importedAt && (
                  <div>
                    <strong>{t('backupReportImportedAt')}:</strong>{' '}
                    {formatBackupDate(importReportModal.summary.importedAt)}
                  </div>
                )}
              </div>
            </div>

            {importReportModal.summary?.sourceMeta &&
              Object.values(importReportModal.summary.sourceMeta).some((value) => value != null) && (
                <div>
                  <div className="text-[12px] font-extrabold mb-2 text-noorix-muted">
                    {t('backupReportMeta')}
                  </div>
                  <div className="text-[13px] leading-[1.85]">
                    {importReportModal.summary.sourceMeta.exportedAt && (
                      <div>
                        <strong>{t('backupReportExportedAt')}:</strong>{' '}
                        {formatBackupDate(importReportModal.summary.sourceMeta.exportedAt)}
                      </div>
                    )}
                    {importReportModal.summary.sourceMeta.version != null && (
                      <div>
                        <strong>{t('backupReportVersion')}:</strong>{' '}
                        {String(importReportModal.summary.sourceMeta.version)}
                      </div>
                    )}
                    {importReportModal.summary.sourceMeta.originalCompanyId && (
                      <div>
                        <strong>{t('backupReportOriginalCompany')}:</strong>{' '}
                        <code className="text-[11px]">{importReportModal.summary.sourceMeta.originalCompanyId}</code>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {importReportModal.summary?.counts && (
              <BackupCountsGrid counts={importReportModal.summary.counts} t={t} lang={lang} />
            )}

            {Array.isArray(importReportModal.summary?.importWarnings) &&
              importReportModal.summary.importWarnings.length > 0 && (
                <div>
                  <div className="text-[12px] font-extrabold mb-2 text-noorix-muted">
                    {t('backupReportImportWarnings')}
                  </div>
                  <ul className="text-[12px] text-noorix-text m-0 pl-4 list-disc space-y-1 leading-relaxed">
                    {importReportModal.summary.importWarnings.map((warning, index) => (
                      <li key={`${index}-${warning}`} className="break-words">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <details className="text-[12px]">
              <summary className="cursor-pointer font-bold">{t('backupReportRawJson')}</summary>
              <pre className="text-[11px] bg-noorix-bg-muted p-3 overflow-auto nx-ltr mt-2.5 rounded-lg max-h-[220px] text-left">
                {JSON.stringify(importReportModal, null, 2)}
              </pre>
            </details>
          </div>

          <div className="flex justify-stretch sm:justify-end mt-[18px]">
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="w-full min-h-[44px] sm:w-auto"
              onClick={() => setImportReportModal(null)}
            >
              {t('close')}
            </Button>
          </div>
        </>
      )}
    </AdaptiveSheet>
  );
}
