import React from 'react';
import { Button, Input, Card, Divider } from '../../../../ui';

/**
 * بطاقة نسخ الشركة: تشغيل يدوي + جدولة + Google Drive
 */
export function BackupCompanySection({
  t,
  activeCompanies,
  companyId,
  setCompanyId,
  coForm,
  setCoForm,
  coCfgRes,
  triggerMut,
  saveCoMut,
}: any) {
  return (
    <section className="min-w-0 flex flex-col gap-0" aria-labelledby="backup-company-title">
      <Card padding="sm" className="flex flex-col gap-4 min-w-0">
        <div className="flex flex-col gap-3 min-w-0">
          <h3 id="backup-company-title" className="text-[14px] font-bold text-noorix-text m-0">
            {t('backupCompanyCardTitle')}
          </h3>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:gap-3 min-w-0">
            <div className="flex-1 min-w-0 w-full">
              <Input
                type="select"
                label={t('backupCompanyPick')}
                value={companyId}
                onChange={(e: any) => setCompanyId(e.target.value)}
                disabled={!activeCompanies.length}
                aria-label={t('backupCompanySection')}
              >
                {activeCompanies.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr || c.nameEn || c.id}
                  </option>
                ))}
              </Input>
            </div>
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="w-full min-h-[44px] shrink-0 sm:w-auto sm:min-h-[44px]"
              disabled={!companyId || !activeCompanies.length || triggerMut.isPending}
              onClick={() => triggerMut.mutate()}
            >
              {triggerMut.isPending ? t('loading') : t('backupRunNow')}
            </Button>
          </div>
        </div>

        <Divider />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 min-w-0">
            <p className="text-[12px] font-semibold text-noorix-text m-0 min-w-0">{t('backupCompanyScheduleTitle')}</p>
            <p className="text-[11px] text-noorix-muted m-0 leading-snug min-w-0 sm:max-w-[min(100%,18rem)] sm:text-end">
              {t('backupCompanyScheduleHint')}
            </p>
          </div>
          <label className="nx-checkbox flex items-center gap-2.5 text-[13px] font-medium text-noorix-text cursor-pointer select-none py-0.5">
            <input
              type="checkbox"
              checked={coForm.enabled}
              onChange={(e: any) => setCoForm((p: any) => ({ ...p, enabled: e.target.checked }))}
              disabled={!companyId}
            />
            <span>{t('backupCompanyDailyEnabled')}</span>
          </label>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3 min-w-0">
            <div className="flex flex-col gap-1 min-w-0">
              <label htmlFor="co-backup-h" className="text-[11px] font-bold text-noorix-muted">
                {t('backupSystemHour')}
              </label>
              <Input
                id="co-backup-h"
                type="number"
                min={0}
                max={23}
                className="noorix-bank-filter"
                value={coForm.scheduleHour}
                onChange={(e: any) =>
                  setCoForm((p: any) => ({
                    ...p,
                    scheduleHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                  }))
                }
                disabled={!companyId}
              />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <label htmlFor="co-backup-m" className="text-[11px] font-bold text-noorix-muted">
                {t('backupSystemMinute')}
              </label>
              <Input
                id="co-backup-m"
                type="number"
                min={0}
                max={59}
                className="noorix-bank-filter"
                value={coForm.scheduleMinute}
                onChange={(e: any) =>
                  setCoForm((p: any) => ({
                    ...p,
                    scheduleMinute: Math.min(59, Math.max(0, Number(e.target.value) || 0)),
                  }))
                }
                disabled={!companyId}
              />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <label htmlFor="co-backup-ret" className="text-[11px] font-bold text-noorix-muted">
                {t('backupCompanyRetention')}
              </label>
              <Input
                id="co-backup-ret"
                type="number"
                min={1}
                max={50}
                className="noorix-bank-filter"
                value={coForm.retentionCount}
                onChange={(e: any) =>
                  setCoForm((p: any) => ({
                    ...p,
                    retentionCount: Math.min(50, Math.max(1, Number(e.target.value) || 5)),
                  }))
                }
                disabled={!companyId}
              />
            </div>
          </div>

          <Divider />

          <div className="flex flex-col gap-2 min-w-0">
            <p className="text-[12px] font-semibold text-noorix-text m-0">{t('backupGdriveSectionTitle')}</p>
            <Input
              type="text"
              label={t('backupGdriveScriptUrlLabel')}
              value={coForm.gdriveScriptUrl}
              onChange={(e: any) => setCoForm((p: any) => ({ ...p, gdriveScriptUrl: e.target.value }))}
              disabled={!companyId}
              placeholder="https://script.google.com/macros/s/…/exec"
              className="nx-ltr text-left"
              dir="ltr"
            />
            <p className="text-[10px] text-noorix-muted m-0 leading-snug">{t('backupGdriveScriptUrlHint')}</p>
            <Input
              type="text"
              label={t('backupGdriveFolderLabel')}
              value={coForm.gdriveFolderId}
              onChange={(e: any) => setCoForm((p: any) => ({ ...p, gdriveFolderId: e.target.value }))}
              disabled={!companyId}
              placeholder="folderId أو رابط المجلد"
              className="nx-ltr text-left"
              dir="ltr"
            />
            <p className="text-[10px] text-noorix-muted m-0 leading-snug">{t('backupGdriveFolderHint')}</p>
          </div>

          {coCfgRes?.success && coCfgRes.data?.lastRunDayRiyadh != null && (
            <p className="text-[11px] text-noorix-muted m-0">
              {t('backupCompanyLastRun')}: <strong dir="ltr">{coCfgRes.data.lastRunDayRiyadh}</strong>
            </p>
          )}
          <div className="flex justify-stretch sm:justify-end pt-1 sm:pt-0">
            <Button
              type="button"
              size="sm"
              className="w-full min-h-[44px] sm:w-auto"
              disabled={!companyId || saveCoMut.isPending}
              onClick={() =>
                saveCoMut.mutate({
                  companyId,
                  enabled: coForm.enabled,
                  scheduleHour: coForm.scheduleHour,
                  scheduleMinute: coForm.scheduleMinute,
                  retentionCount: coForm.retentionCount,
                  gdriveScriptUrl: coForm.gdriveScriptUrl,
                  gdriveFolderId: coForm.gdriveFolderId,
                })
              }
            >
              {saveCoMut.isPending ? t('loading') : t('backupCompanySave')}
            </Button>
          </div>
        </div>

        {!activeCompanies.length && (
          <p className="text-[11px] text-noorix-amber m-0">{t('noActiveCompanies')}</p>
        )}

        <details className="rounded-lg border border-dashed border-noorix-border bg-noorix-bg-muted/50 px-3 py-2.5">
          <summary className="cursor-pointer text-[12px] font-semibold text-noorix-muted list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
            <span>{t('backupMoreInfo')}</span>
            <span className="text-noorix-muted opacity-70" aria-hidden>
              +
            </span>
          </summary>
          <p className="text-[11px] text-noorix-muted mt-2 m-0 leading-relaxed">{t('backupMoreInfoBody')}</p>
        </details>
      </Card>
    </section>
  );
}
