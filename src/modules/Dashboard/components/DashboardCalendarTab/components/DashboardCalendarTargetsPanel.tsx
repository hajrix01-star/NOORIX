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
  /** true = الهدف لكل الشهور، false = هذا الشهر فقط */
  applyToAll: boolean;
  onToggleApplyToAll: (v: boolean) => void;
  /** true = البيانات المعروضة هي الهدف الافتراضي (لم يُخصَّص هذا الشهر) */
  isDefaultTargets: boolean;
  /** true = يوجد تخصيص مختلف لهذا الشهر */
  hasMonthOverride: boolean;
  onResetMonthTargets: () => void;
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
  applyToAll,
  onToggleApplyToAll,
  isDefaultTargets,
  hasMonthOverride,
  onResetMonthTargets,
  lang,
  t,
}: DashboardCalendarTargetsPanelProps) {
  if (!show) return null;

  return (
    <div className="p-3 mb-3 bg-noorix-bg-muted rounded-lg text-[12px]">

      {/* شريط الحالة + Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-noorix-border">
        <div className="flex items-center gap-2">
          {hasMonthOverride ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-noorix-blue text-white">
              ★ {t('dashboardTargetMonthSpecific') || 'مخصص لهذا الشهر'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-noorix-bg text-noorix-muted border border-noorix-border">
              {t('dashboardTargetDefault') || 'الهدف الافتراضي — لكل الشهور'}
            </span>
          )}
        </div>

        {/* زر إعادة الشهر للافتراضي */}
        {hasMonthOverride && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onResetMonthTargets}
            className="text-noorix-red text-[11px]"
          >
            ↩ {t('dashboardTargetResetToDefault') || 'إعادة للافتراضي'}
          </Button>
        )}
      </div>

      {/* Toggle: لكل الشهور / هذا الشهر فقط */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-noorix-muted">{t('dashboardTargetScopeLabel') || 'حفظ الهدف'}:</span>
        <div className="flex items-center gap-1 bg-noorix-bg rounded-lg p-0.5 border border-noorix-border">
          <Button
            type="button"
            variant="raw"
            size="auto"
            onClick={() => onToggleApplyToAll(true)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              applyToAll
                ? 'bg-white shadow-sm text-noorix-blue border border-noorix-border'
                : 'text-noorix-muted hover:text-noorix-text'
            }`}
          >
            {t('dashboardTargetAllMonths') || 'لكل الشهور'}
          </Button>
          <Button
            type="button"
            variant="raw"
            size="auto"
            onClick={() => onToggleApplyToAll(false)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              !applyToAll
                ? 'bg-white shadow-sm text-noorix-blue border border-noorix-border'
                : 'text-noorix-muted hover:text-noorix-text'
            }`}
          >
            {t('dashboardTargetThisMonthOnly') || 'هذا الشهر فقط'}
          </Button>
        </div>
      </div>

      {/* الهدف الإجمالي اليومي */}
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
          <span className="nx-font-numbers">
            {targets.overall != null ? fmt(targets.overall) : '—'} <span className="nx-sar">SR</span>
          </span>
          <Button onClick={onStartEditOverall}>{t('edit')}</Button>
        </div>
      )}

      {/* أهداف أيام الأسبوع */}
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

      {!isDefaultTargets && (
        <p className="mt-2 text-[11px] text-noorix-muted">
          {t('dashboardTargetDefaultNote') || '💡 الأشهر الأخرى تستخدم الهدف الافتراضي العام'}
        </p>
      )}
    </div>
  );
}
