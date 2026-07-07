import React from 'react';
import { Card, Badge, KebabMenu } from '../../../../ui';
import { formatSaudiDateTime } from '../../../../utils/saudiDate';
import type {
  BackupImportModal,
  BackupJob,
  SettingsMutationLike,
  TranslationFn,
} from '../../settingsTypes';
import {
  formatFileSize,
  defaultImportCompanyName,
  scopeLabel,
  statusLabel,
  statusBadgeColor,
} from './backupTabHelpers';

type BackupJobsHistoryProps = {
  t: TranslationFn;
  lang: string;
  isLoading: boolean;
  jobs: BackupJob[];
  reportMut: SettingsMutationLike<string>;
  downloadMut: SettingsMutationLike<string>;
  verifyCoMut: SettingsMutationLike<string>;
  setImportNameAr: (value: string) => void;
  setImportConfirmed: (value: boolean) => void;
  setImportModal: (value: BackupImportModal | null) => void;
};

export function BackupJobsHistory({
  t,
  lang,
  isLoading,
  jobs,
  reportMut,
  downloadMut,
  verifyCoMut,
  setImportNameAr,
  setImportConfirmed,
  setImportModal,
}: BackupJobsHistoryProps) {
  return (
    <section className="flex flex-col gap-3 min-w-0 w-full" aria-labelledby="backup-log-title">
      <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h3 id="backup-log-title" className="text-[14px] font-bold text-noorix-text m-0 min-w-0">
            {t('backupJobHistory')}
          </h3>
          {!isLoading && jobs.length > 0 && (
            <Badge color="gray" size="sm">
              {jobs.length}
            </Badge>
          )}
        </div>
      </div>
      {isLoading && <p className="text-[12px] text-noorix-muted m-0">{t('loading')}</p>}
      {!isLoading && jobs.length === 0 && <p className="text-[12px] text-noorix-muted m-0">{t('backupNoJobs')}</p>}
      <div className="flex flex-col gap-2 overflow-x-auto min-w-0 -mx-0.5 px-0.5">
        {jobs.map((job) => {
          const metaParts = [
            formatSaudiDateTime(job.createdAt),
            job.sizeBytes != null ? formatFileSize(job.sizeBytes) : '',
            job.durationMs != null ? `${job.durationMs} ms` : '',
          ].filter(Boolean);
          const title =
            `${scopeLabel(job.scope, t)}${job.company ? ` - ${job.company.nameAr || job.company.nameEn || ''}` : ''}${
              job.ordinal != null ? ` - ${t('backupOrdinalLabel')} ${job.ordinal}` : ''
            }`;

          return (
            <Card key={job.id} padding="sm" className="flex flex-col gap-2.5 min-w-0">
              <div className="flex items-start gap-2 min-w-0">
                <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-noorix-text break-words min-w-0">{title}</span>
                  <Badge color={statusBadgeColor(job.status)} size="sm" className="shrink-0">
                    {statusLabel(job.status, t)}
                  </Badge>
                </div>
                <div className="shrink-0 pt-0.5 min-h-[44px] min-w-[44px] flex items-start justify-center">
                  <KebabMenu
                    ariaLabel={t('backupActionsMenu')}
                    menuWidth={200}
                    items={[
                      {
                        key: 'report',
                        label: t('backupRestoreReport'),
                        onClick: () => reportMut.mutate(job.id),
                      },
                      {
                        key: 'download',
                        label: t('backupDownload'),
                        hidden: !(job.scope === 'company_logical' && job.status === 'completed' && job.localRelativePath),
                        onClick: () => downloadMut.mutate(job.id),
                      },
                      {
                        key: 'import',
                        label: t('backupImportNewCompany'),
                        hidden: !(job.scope === 'company_logical' && job.status === 'completed' && job.localRelativePath),
                        onClick: () => {
                          setImportNameAr(defaultImportCompanyName(job, t, lang));
                          setImportConfirmed(false);
                          setImportModal({ jobId: job.id });
                        },
                      },
                      {
                        key: 'verify',
                        label: t('backupVerify'),
                        hidden: !(job.scope === 'company_logical' && job.status === 'completed' && job.localRelativePath),
                        onClick: () => verifyCoMut.mutate(job.id),
                      },
                    ]}
                  />
                </div>
              </div>
              <p className="text-[11px] text-noorix-muted m-0 leading-snug break-words">{metaParts.join(' - ')}</p>
              {job.errorMessage && (
                <p className="text-[11px] text-noorix-red m-0 break-words">{job.errorMessage}</p>
              )}
              {job.verifyOk === true && (
                <p className="text-[11px] text-noorix-green m-0 font-medium">{t('backupVerifyOk')}</p>
              )}
              {job.verifyOk === false && job.verifyError && (
                <p className="text-[11px] text-noorix-red m-0 break-words">{job.verifyError}</p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
