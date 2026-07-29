import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { BackupConfigData, BackupScheduleForm } from '../../settingsTypes';

type BackupScheduleFormsModel = {
  sysForm: BackupScheduleForm;
  setSysForm: Dispatch<SetStateAction<BackupScheduleForm>>;
  coForm: BackupScheduleForm;
  setCoForm: Dispatch<SetStateAction<BackupScheduleForm>>;
};

const systemScheduleDefaults: BackupScheduleForm = {
  enabled: false,
  scheduleHour: 6,
  scheduleMinute: 0,
  retentionCount: 10,
  gdriveScriptUrl: '',
  gdriveFolderId: '',
};

const companyScheduleDefaults: BackupScheduleForm = {
  enabled: false,
  scheduleHour: 6,
  scheduleMinute: 0,
  retentionCount: 5,
  gdriveScriptUrl: '',
  gdriveFolderId: '',
};

function scheduleNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function scheduleRetention(value: unknown, fallback: number): number {
  return Math.min(50, Math.max(1, scheduleNumber(value, fallback)));
}

function scheduleText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function scheduleFormFromConfig(config: BackupConfigData, fallbackRetention: number): BackupScheduleForm {
  return {
    enabled: !!config.enabled,
    scheduleHour: scheduleNumber(config.scheduleHour, 6),
    scheduleMinute: scheduleNumber(config.scheduleMinute, 0),
    retentionCount: scheduleRetention(config.retentionCount, fallbackRetention),
    gdriveScriptUrl: scheduleText(config.gdriveScriptUrl),
    gdriveFolderId: scheduleText(config.gdriveFolderId),
  };
}

export function useBackupScheduleForms(
  sysCfgData: BackupConfigData | undefined,
  coCfgData: BackupConfigData | undefined,
): BackupScheduleFormsModel {
  const [sysForm, setSysForm] = useState<BackupScheduleForm>(systemScheduleDefaults);
  const [coForm, setCoForm] = useState<BackupScheduleForm>(companyScheduleDefaults);

  useEffect(() => {
    if (!sysCfgData || typeof sysCfgData !== 'object' || sysCfgData.enabled === undefined) return;
    setSysForm(scheduleFormFromConfig(sysCfgData, 10));
  }, [sysCfgData]);

  useEffect(() => {
    if (!coCfgData || typeof coCfgData !== 'object') return;
    setCoForm(scheduleFormFromConfig(coCfgData, 5));
  }, [coCfgData]);

  return { sysForm, setSysForm, coForm, setCoForm };
}
