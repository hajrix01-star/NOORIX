import React from 'react';
import { ColorSwatch } from '../../../../../ui';
import type { DashboardSpecialDay } from '../../../../../types/api/domains/dashboard';

export interface DashboardCalendarSpecialDaysStripProps {
  specialDays: DashboardSpecialDay[];
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
}

function shortDate(value: string) {
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}`;
}

function rangeLabel(item: DashboardSpecialDay) {
  if (item.fromDate === item.toDate) return shortDate(item.fromDate);
  return `${shortDate(item.fromDate)} - ${shortDate(item.toDate)}`;
}

export default function DashboardCalendarSpecialDaysStrip({
  specialDays,
  lang,
  t,
}: DashboardCalendarSpecialDaysStripProps) {
  if (!specialDays.length) return null;

  const visible = specialDays.slice(0, 5);
  const hiddenCount = Math.max(0, specialDays.length - visible.length);
  const moreLabel = lang === 'ar' ? `+${hiddenCount} أخرى` : `+${hiddenCount} more`;

  return (
    <section className="mb-3 rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2">
      <div className="mb-1.5 text-[11px] font-bold text-noorix-text">
        {t('dashboardSpecialDays')}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {visible.map((item) => (
          <span
            key={item.id}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-noorix-border bg-noorix-bg-surface px-2 py-1 text-[11px] font-semibold text-noorix-text"
            title={`${item.name} ${rangeLabel(item)}`}
          >
            <ColorSwatch className="h-2 w-2 shrink-0 rounded-full" color={item.color} />
            <span className="truncate">{item.name}</span>
            <span className="shrink-0 text-noorix-muted nx-font-numbers">{rangeLabel(item)}</span>
          </span>
        ))}
        {hiddenCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-noorix-blue-8 px-2 py-1 text-[11px] font-bold text-noorix-blue">
            {moreLabel}
          </span>
        )}
      </div>
    </section>
  );
}
