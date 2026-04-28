import React from 'react';
import { FmtNum } from '../../../../../ui';

export interface DashboardCalendarLegendProps {
  lang: string;
  targetsOverall: number | null | undefined;
  t: (key: string, ...args: unknown[]) => string;
}

export default function DashboardCalendarLegend({ lang, targetsOverall, t }: DashboardCalendarLegendProps) {
  return (
    <div className="mt-4 p-3 bg-noorix-bg-muted rounded-lg text-[11px]">
      <div className="font-bold mb-2 text-noorix-text">{lang === 'ar' ? 'دليل الألوان' : 'Color legend'}</div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-8">
          <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'var(--noorix-border)', border: '1px solid var(--noorix-border)' }} />
          <span>{t('dashboardLegendGray')}</span>
        </div>
        <div className="flex items-center gap-8">
          <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'var(--color-nx-expenses)' }} />
          <span>{t('dashboardLegendRed')}</span>
        </div>
        <div className="flex items-center gap-8">
          <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'var(--noorix-accent-amber)' }} />
          <span>{t('dashboardLegendYellow')}</span>
        </div>
        <div className="flex items-center gap-8">
          <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'var(--color-nx-profit)' }} />
          <span>{t('dashboardLegendGreen')}</span>
        </div>
        <div className="flex items-center gap-8">
          <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'var(--color-nx-sales)' }} />
          <span>{t('dashboardLegendBlue')}</span>
        </div>
        <div className="flex items-center gap-8">
          <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'color-mix(in srgb, var(--color-nx-profit) 45%, transparent)' }} />
          <span>{t('dashboardLegendGreenNoTarget')}</span>
        </div>
        <div className="flex items-center gap-8">
          <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'var(--noorix-violet-50)' }} />
          <span>{t('dashboardLegendSpecial')}</span>
        </div>
      </div>
      {targetsOverall != null && (
        <div className="text-noorix-muted mt-2 border-t border-noorix-border pt-2 text-[10px]">
          {t('dashboardSalesTarget')}: <FmtNum n={targetsOverall} /> <span className="nx-sar">SR</span>
        </div>
      )}
    </div>
  );
}
