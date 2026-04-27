import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import type { AnalyticsStudioAlert } from './types';
import { cn } from '../../ui';

export type AnalyticsSmartAlertsProps = {
  loading: boolean;
  alerts: AnalyticsStudioAlert[];
};

export default function AnalyticsSmartAlerts({ loading, alerts }: AnalyticsSmartAlertsProps) {
  const { lang } = useTranslation();

  if (loading) return null;
  if (!alerts.length) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-noorix-border bg-[var(--noorix-bg-surface)] p-4 text-[13px] text-noorix-muted">
        {lang === 'en' ? 'No alerts for this period.' : 'لا تنبيهات لهذه الفترة.'}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-3">
      <div className="text-[14px] font-bold">{lang === 'en' ? 'Alerts' : 'تنبيهات'}</div>
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li
            key={a.id}
            className={cn(
              'rounded-lg border px-4 py-3 text-[13px]',
              a.severity === 'warning'
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-noorix-border bg-[var(--noorix-bg-surface)]',
            )}
          >
            {lang === 'en' ? a.messageEn : a.messageAr}
          </li>
        ))}
      </ul>
    </div>
  );
}
