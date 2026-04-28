import React from 'react';
import { Button, Input } from '../../../../../ui';
import { fmt } from '../../../../../utils/format';
import { DOW_KEYS, DOW_LABELS, DOW_LABELS_AR } from '../constants';

export interface DashboardCalendarTargetsPanelProps {
  show: boolean;
  targetsVersion: number;
  targets: { overall: number | null | undefined; byDow: Record<number, number | undefined> };
  editingTarget: boolean;
  targetInput: string;
  onTargetInputChange: (v: string) => void;
  onSaveOverallTarget: () => void;
  onCancelEditOverall: () => void;
  onStartEditOverall: () => void;
  onSaveDowTarget: (dow: number, value: unknown) => void;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
}

export default function DashboardCalendarTargetsPanel({
  show,
  targetsVersion,
  targets,
  editingTarget,
  targetInput,
  onTargetInputChange,
  onSaveOverallTarget,
  onCancelEditOverall,
  onStartEditOverall,
  onSaveDowTarget,
  lang,
  t,
}: DashboardCalendarTargetsPanelProps) {
  if (!show) return null;
  return (
    <div className="p-3 mb-3 bg-noorix-bg-muted rounded-lg text-[12px]">
      <div className="font-bold mb-2">{t('dashboardTargetOverall')}</div>
      {editingTarget ? (
        <div className="flex items-center gap-8 mb-[10px]">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={targetInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTargetInputChange(e.target.value)}
            placeholder={t('dashboardSalesTarget')}
            className="w-[120px]"
          />
          <Button variant="primary" onClick={onSaveOverallTarget}>
            {t('save')}
          </Button>
          <Button onClick={onCancelEditOverall}>{t('cancel')}</Button>
        </div>
      ) : (
        <div className="flex items-center gap-8 mb-[10px]">
          <span style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
            {targets.overall != null ? fmt(targets.overall) : '—'} <span className="nx-sar">SR</span>
          </span>
          <Button onClick={onStartEditOverall}>{t('edit')}</Button>
        </div>
      )}
      <div className="font-bold mb-1.5">{t('dashboardTargetByDay')}</div>
      <div className="flex flex-wrap gap-2" key={`targets-${targetsVersion}`}>
        {DOW_KEYS.map((dow) => (
          <div key={dow} className="flex items-center gap-4">
            <span className="text-[11px] min-w-[50px]">
              {lang === 'ar' ? DOW_LABELS_AR[dow] : DOW_LABELS[dow]}:
            </span>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="—"
              defaultValue={targets.byDow[dow] ?? ''}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => onSaveDowTarget(dow, e.target.value)}
              className="w-[70px]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
