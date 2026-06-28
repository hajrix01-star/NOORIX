import React from 'react';
import { Card, Badge, KebabMenu } from '../../../../ui';
import { formatSaudiDateTime } from '../../../../utils/saudiDate';
import {
  formatFileSize,
  defaultImportCompanyName,
  scopeLabel,
  statusLabel,
  statusBadgeColor,
} from './backupTabHelpers';

/**
 * سجل مهام النسخ الاحتياطي للشركات (من الجدول العام)
 */
export function BackupJobsHistory({
  t,
  lang,
  isLoading,
  jobs,
  reportMut,
  downloadMut,
  verifyCoMut,
  retryMut,
  setImportNameAr,
  setImportConfirmed,
  setImportModal,
}: any) {
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
        {jobs.map((j: any) => {
          const metaParts = [
            formatSaudiDateTime(j.createdAt),
            j.sizeBytes != null ? formatFileSize(j.sizeBytes) : '',
            j.durationMs != null ? `${j.durationMs} ms` : '',
          ].filter(Boolean);
          const title =
            `${scopeLabel(j.scope, t)}${j.company ? ` — ${j.company.nameAr || j.company.nameEn || ''}` : ''}${
              j.ordinal != null ? ` · ${t('backupOrdinalLabel')} ${j.ordinal}` : ''
            }`;
          return (
            <Card key={j.id} padding="sm" className="flex flex-col gap-2.5 min-w-0">
              <div className="flex items-start gap-2 min-w-0">
                <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-noorix-text break-words min-w-0">{title}</span>
                  <Badge color={statusBadgeColor(j.status)} size="sm" className="shrink-0">
                    {statusLabel(j.status, t)}
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
                        onClick: () => reportMut.mutate(j.id),
                      },
                      {
                        key: 'download',
                        label: t('backupDownload'),
                        hidden: !(j.scope === 'company_logical' && j.status === 'completed' && j.localRelativePath),
                        onClick: () => downloadMut.mutate(j.id),
                      },
                      {
                        key: 'import',
                        label: t('backupImportNewCompany'),
                        hidden: !(j.scope === 'company_logical' && j.status === 'completed' && j.localRelativePath),
                        onClick: () => {
                          setImportNameAr(defaultImportCompanyName(j, t, lang));
                          setImportConfirmed(false);
                          setImportModal({ jobId: j.id });
                        },
                      },
                      {
                        key: 'verify',
                        label: t('backupVerify'),
                        hidden: !(j.scope === 'company_logical' && j.status === 'completed' && j.localRelativePath),
                        onClick: () => verifyCoMut.mutate(j.id),
                      },
                    ]}
                  />
                </div>
              </div>
              <p className="text-[11px] text-noorix-muted m-0 leading-snug break-words">{metaParts.join(' · ')}</p>
              {j.errorMessage && (
                <p className="text-[11px] text-noorix-red m-0 break-words">{j.errorMessage}</p>
              )}
              {j.verifyOk === true && (
                <p className="text-[11px] text-noorix-green m-0 font-medium">{t('backupVerifyOk')}</p>
              )}
              {j.verifyOk === false && j.verifyError && (
                <p className="text-[11px] text-noorix-red m-0 break-words">{j.verifyError}</p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
