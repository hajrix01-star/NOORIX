import React, { type ChangeEvent } from 'react';
import { Button, Checkbox, Input, AdaptiveSheet, Modal } from '../../../../ui';
import type {
  BackupImportModal,
  BackupImportReport,
  BackupImportVariables,
  BackupReportModal,
  BackupRestoreModal,
  BackupRestorePcModal,
  BackupRestorePcVariables,
  BackupRestoreVariables,
  SettingsMutationLike,
  TranslationFn,
} from '../../settingsTypes';
import { formatBackupDate, scopeLabel } from './backupTabHelpers';
import { BackupCountsGrid } from './BackupCountsGrid';

/**
 * أدراج ونوافذ تأكيد النسخ الاحتياطي
 */
type BackupSheetsAndModalsProps = {
  t: TranslationFn;
  lang: string;
  isAr: boolean;
  importModal: BackupImportModal | null;
  setImportModal: (value: BackupImportModal | null) => void;
  importMut: SettingsMutationLike<BackupImportVariables>;
  importNameAr: string;
  setImportNameAr: (value: string) => void;
  importConfirmed: boolean;
  setImportConfirmed: (value: boolean) => void;
  importStrictAlloc: boolean;
  setImportStrictAlloc: (value: boolean) => void;
  reportModal: BackupReportModal | null;
  setReportModal: (value: BackupReportModal | null) => void;
  importReportModal: BackupImportReport | null;
  setImportReportModal: (value: BackupImportReport | null) => void;
  restorePcModal: BackupRestorePcModal | null;
  setRestorePcModal: (value: BackupRestorePcModal | null) => void;
  restorePcPhrase: string;
  setRestorePcPhrase: (value: string) => void;
  restorePcMut: SettingsMutationLike<BackupRestorePcVariables>;
  restoreModal: BackupRestoreModal | null;
  setRestoreModal: (value: BackupRestoreModal | null) => void;
  restorePhrase: string;
  setRestorePhrase: (value: string) => void;
  restoreMut: SettingsMutationLike<BackupRestoreVariables>;
};

export function BackupSheetsAndModals({
  t,
  lang,
  isAr,
  importModal,
  setImportModal,
  importMut,
  importNameAr,
  setImportNameAr,
  importConfirmed,
  setImportConfirmed,
  importStrictAlloc,
  setImportStrictAlloc,
  reportModal,
  setReportModal,
  importReportModal,
  setImportReportModal,
  restorePcModal,
  setRestorePcModal,
  restorePcPhrase,
  setRestorePcPhrase,
  restorePcMut,
  restoreModal,
  setRestoreModal,
  restorePhrase,
  setRestorePhrase,
  restoreMut,
}: BackupSheetsAndModalsProps) {
  return (
    <>
      <AdaptiveSheet
        open={!!importModal}
        onClose={() =>
          !importMut.isPending &&
          (setImportModal(null), setImportConfirmed(false), setImportStrictAlloc(false))
        }
        title={t('backupImportNewCompany')}
        size="md"
        side="start"
        className="backup-import-drawer"
      >
        <div
          className="text-[13px] font-medium py-[10px] px-[14px] mb-[14px] rounded-md leading-[1.65] bg-noorix-red/10 border border-noorix-red/45 text-noorix-red"
          role="alert"
        >
          {isAr
            ? '⚠️ تحذير: سيتم إنشاء شركة جديدة كاملة من هذه النسخة الاحتياطية. تأكد من صحة النسخة قبل المتابعة.'
            : '⚠️ Warning: A new company will be created from this backup. Make sure the backup is correct before proceeding.'}
        </div>

        <p className="text-[13px] text-noorix-muted m-0 mb-3 leading-[1.6]">
          {t('backupImportWarn')}
        </p>

        <Input
          type="text"
          label={t('backupImportNameLabel')}
          value={importNameAr}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setImportNameAr(event.target.value)}
        />

        <Checkbox
          checked={importConfirmed}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setImportConfirmed(event.target.checked)}
          label={(
          <span>
            {isAr
              ? 'أؤكد أنني أرغب في إنشاء شركة جديدة من هذه النسخة الاحتياطية'
              : 'I confirm I want to create a new company from this backup'}
          </span>
          )}
          containerClassName="nx-checkbox text-[13px] text-noorix-text mt-3 mb-2 leading-[1.5]"
        />

        <Checkbox
          checked={importStrictAlloc}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setImportStrictAlloc(event.target.checked)}
          label={t('backupImportStrictAllocations')}
          containerClassName="nx-checkbox text-[13px] text-noorix-text mb-1 leading-[1.5]"
        />
        <p className="text-[10px] text-noorix-muted m-0 mb-4 leading-snug">{t('backupImportStrictAllocationsHint')}</p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={importMut.isPending}
            onClick={() => {
              setImportModal(null);
              setImportConfirmed(false);
              setImportStrictAlloc(false);
            }}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={importMut.isPending || !importNameAr.trim() || !importConfirmed}
            onClick={() =>
              importModal &&
              importMut.mutate({
                jobId: importModal.jobId,
                nameAr: importNameAr.trim(),
                failOnAllocationWarnings: importStrictAlloc,
              })
            }
          >
            {importMut.isPending ? t('loading') : t('backupImportRun')}
          </Button>
        </div>
      </AdaptiveSheet>

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

      <Modal
        open={!!restorePcModal}
        onClose={() =>
          !restorePcMut.isPending && (setRestorePcModal(null), setRestorePcPhrase(''))
        }
        title={t('backupSystemRestoreFromPc')}
        size="md"
        variant="danger"
      >
        <div
          className="text-[13px] font-medium py-[10px] px-[14px] mb-3 rounded-md leading-[1.65] bg-noorix-red/10 border border-noorix-red/45 text-noorix-red"
          role="alert"
        >
          {t('backupSystemRestoreFromPcWarn')}
        </div>
        <p className="text-[12px] text-noorix-muted m-0 mb-2 leading-[1.6]">
          {restorePcModal?.file?.name ? (
            <span dir="ltr" className="font-mono break-all">
              {restorePcModal.file.name}
            </span>
          ) : null}
        </p>
        <p className="text-[12px] text-noorix-muted m-0 mb-3 leading-[1.6]">{t('backupSystemRestorePhraseHint')}</p>
        <Input
          type="text"
          label={t('backupSystemRestorePhraseLabel')}
          value={restorePcPhrase}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setRestorePcPhrase(event.target.value)}
          className="nx-ltr"
          dir="ltr"
          autoComplete="off"
        />
        <p className="text-[11px] text-noorix-muted mt-2 m-0">{t('backupRestoreExitHint')}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end mt-4">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={restorePcMut.isPending}
            onClick={() => (setRestorePcModal(null), setRestorePcPhrase(''))}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={restorePcMut.isPending || !restorePcPhrase.trim() || !restorePcModal?.file}
            onClick={() =>
              restorePcModal?.file &&
              restorePcMut.mutate({
                file: restorePcModal.file,
                confirmPhrase: restorePcPhrase.trim(),
              })
            }
          >
            {restorePcMut.isPending ? t('loading') : t('backupSystemRestoreConfirm')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!restoreModal}
        onClose={() => !restoreMut.isPending && (setRestoreModal(null), setRestorePhrase(''))}
        title={t('backupSystemRestore')}
        size="md"
        variant="danger"
      >
        <div
          className="text-[13px] font-medium py-[10px] px-[14px] mb-3 rounded-md leading-[1.65] bg-noorix-red/10 border border-noorix-red/45 text-noorix-red"
          role="alert"
        >
          {t('backupSystemRestoreWarn')}
        </div>
        <p className="text-[12px] text-noorix-muted m-0 mb-3 leading-[1.6]">{t('backupSystemRestorePhraseHint')}</p>
        <Input
          type="text"
          label={t('backupSystemRestorePhraseLabel')}
          value={restorePhrase}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setRestorePhrase(event.target.value)}
          className="nx-ltr"
          dir="ltr"
          autoComplete="off"
        />
        <p className="text-[11px] text-noorix-muted mt-2 m-0">{t('backupRestoreExitHint')}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end mt-4">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={restoreMut.isPending}
            onClick={() => (setRestoreModal(null), setRestorePhrase(''))}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={restoreMut.isPending || !restorePhrase.trim()}
            onClick={() =>
              restoreModal &&
              restoreMut.mutate({ jobId: restoreModal.jobId, confirmPhrase: restorePhrase.trim() })
            }
          >
            {restoreMut.isPending ? t('loading') : t('backupSystemRestoreConfirm')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
