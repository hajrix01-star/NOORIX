import React from 'react';
import { FmtNum } from '../../../../../ui';

export interface DashboardCalendarSalesAvgBannerProps {
  salesDailyAvgOnActiveDays: number | null;
  t: (key: string, ...args: unknown[]) => string;
}

export default function DashboardCalendarSalesAvgBanner({ salesDailyAvgOnActiveDays, t }: DashboardCalendarSalesAvgBannerProps) {
  if (salesDailyAvgOnActiveDays == null) return null;
  return (
    <div className="text-[11px] text-noorix-muted mb-2 flex flex-wrap items-baseline gap-1">
      <span>{t('dashboardSalesDailyAvgActiveDays')}</span>
      <span className="font-semibold text-noorix-text nx-font-numbers">
        <FmtNum n={salesDailyAvgOnActiveDays} /> <span className="nx-sar">SR</span>
      </span>
    </div>
  );
}
