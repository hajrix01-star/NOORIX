import React, { type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { Button, Checkbox, Input, Card, Divider } from '../../../../ui';
import type {
  BackupConfigData,
  BackupSchedulePatch,
  BackupScheduleForm,
  SettingsApiResult,
  SettingsCompany,
  SettingsMutationLike,
  SettingsVoidMutationLike,
  TranslationFn,
} from '../../settingsTypes';

type BackupCompanySectionProps = {
  t: TranslationFn;
  activeCompanies: SettingsCompany[];
  companyId: string;
  setCompanyId: (value: string) => void;
  coForm: BackupScheduleForm;
  setCoForm: Dispatch<SetStateAction<BackupScheduleForm>>;
  coCfgRes?: SettingsApiResult<BackupConfigData>;
  triggerMut: SettingsVoidMutationLike;
  saveCoMut: SettingsMutationLike<BackupSchedulePatch & { companyId: string }>;
};

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
}: BackupCompanySectionProps) {
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
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setCompanyId(event.target.value)}
                disabled={!activeCompanies.length}
                aria-label={t('backupCompanySection')}
              >
                {activeCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.nameAr || company.nameEn || company.id}
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
          <Checkbox
            checked={coForm.enabled}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setCoForm((previous) => ({ ...previous, enabled: event.target.checked }))}
            disabled={!companyId}
            label={t('backupCompanyDailyEnabled')}
            containerClassName="nx-checkbox flex items-center gap-2.5 text-[13px] font-medium text-noorix-text cursor-pointer select-none py-0.5"
          />
          <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3 min-w-0">
            <ScheduleNumberInput
              id="co-backup-h"
              label={t('backupSystemHour')}
              value={coForm.scheduleHour}
              min={0}
              max={23}
              fallback={0}
              disabled={!companyId}
              onValue={(scheduleHour) => setCoForm((previous) => ({ ...previous, scheduleHour }))}
            />
            <ScheduleNumberInput
              id="co-backup-m"
              label={t('backupSystemMinute')}
              value={coForm.scheduleMinute}
              min={0}
              max={59}
              fallback={0}
              disabled={!companyId}
              onValue={(scheduleMinute) => setCoForm((previous) => ({ ...previous, scheduleMinute }))}
            />
            <ScheduleNumberInput
              id="co-backup-ret"
              label={t('backupCompanyRetention')}
              value={coForm.retentionCount}
              min={1}
              max={50}
              fallback={5}
              disabled={!companyId}
              onValue={(retentionCount) => setCoForm((previous) => ({ ...previous, retentionCount }))}
            />
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

type ScheduleNumberInputProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  fallback: number;
  disabled?: boolean;
  onValue: (value: number) => void;
};

function ScheduleNumberInput({ id, label, value, min, max, fallback, disabled, onValue }: ScheduleNumberInputProps) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="text-[11px] font-bold text-noorix-muted">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        className="noorix-bank-filter"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onValue(Math.min(max, Math.max(min, Number(event.target.value) || fallback)))
        }
        disabled={disabled}
      />
    </div>
  );
}
