/**
 * متوسط يومي المبيعات لكل جزء أسبوعي داخل الشهر (1–7، 8–14، …) مقارنة بمرجع.
 */
import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { FmtNum, Input } from '../../../../ui';
import { cn } from '../../../../ui/cn';

/** محاذاة وسط لقائمة الشهر/السنة (جوال + RTL) — أنماط إضافية في index.css */
const PERIOD_SELECT_CLASS = 'nx-dashboard-period-select';

const PERIOD_CONTROLS_WRAP =
  'mx-auto flex w-full max-w-[11rem] flex-col items-center gap-1 sm:flex-row sm:flex-wrap sm:justify-center';

const PERIOD_MONTH_SELECT_CLASS =
  'w-full max-w-[10.5rem] sm:min-w-[104px] sm:flex-1 sm:basis-[6.5rem]';

const PERIOD_YEAR_SELECT_CLASS =
  'w-full max-w-[5.5rem] sm:min-w-[72px] sm:shrink-0 sm:basis-[4.5rem]';

export type WeeklySalesWeekRow = {
  weekIndex: number;
  dayStart: number;
  dayEnd: number;
  avgDailyCurrent: number;
  avgDailyBaseline: number;
  deltaPct: number | null;
};

export type WeeklySalesWeekData = {
  rows: WeeklySalesWeekRow[];
};

type Props = {
  weeklyYearOptions: number[];
  weeklyMonthOptions: ReadonlyArray<{ value: number; label: string }>;
  panelYearA: number;
  panelMonthA: number;
  panelYearB: number;
  panelMonthB: number;
  onPanelYearAChange: (y: number) => void;
  onPanelMonthAChange: (m: number) => void;
  onPanelYearBChange: (y: number) => void;
  onPanelMonthBChange: (m: number) => void;
  data: WeeklySalesWeekData | null;
  isLoading: boolean;
};

export function DashboardOverviewWeeklySalesPanel({
  weeklyYearOptions,
  weeklyMonthOptions,
  panelYearA,
  panelMonthA,
  panelYearB,
  panelMonthB,
  onPanelYearAChange,
  onPanelMonthAChange,
  onPanelYearBChange,
  onPanelMonthBChange,
  data,
  isLoading,
}: Props) {
  const { t } = useTranslation();

  return (
    <section className="min-w-0" aria-label={t('dashboardWeeklySalesTitle')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-noorix-border bg-noorix-bg-muted/40 px-2 py-2.5 sm:gap-3 sm:px-3 sm:py-3">
        <span className="h-7 w-1 shrink-0 rounded-full bg-noorix-blue sm:h-8" aria-hidden />
        <h2 className="m-0 min-w-0 flex-1 text-[12px] font-bold leading-snug text-noorix-text sm:text-[13px]">
          {t('dashboardWeeklySalesTitle')}
        </h2>
      </div>

      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
        {isLoading || !data ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--noorix-surface-2)]" />
            ))}
          </div>
        ) : (
          <table className="w-full min-w-[520px] border-collapse border border-noorix-border text-sm">
            <thead>
              <tr className="bg-[var(--noorix-table-header-bg)]">
                <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold">
                  {t('dashboardWeeklySalesWeekCol')}
                </th>
                <th className="border border-noorix-border px-2 py-2 text-center align-bottom">
                  <div className="mb-0.5 text-[11px] font-bold leading-snug text-noorix-text">{t('dashboardWeeklySalesPeriodMainHeader')}</div>
                  <div className="mb-1 text-[10px] font-semibold text-noorix-muted">{t('dashboardWeeklySalesAvgDailyShort')}</div>
                  <div className={PERIOD_CONTROLS_WRAP}>
                    <Input
                      type="select"
                      size="sm"
                      className={cn(PERIOD_MONTH_SELECT_CLASS, PERIOD_SELECT_CLASS)}
                      value={panelMonthA}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        onPanelMonthAChange(Number(e.target.value))
                      }
                      aria-label={t('dashboardWeeklySalesPeriodAColumn')}
                    >
                      {weeklyMonthOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Input>
                    <Input
                      type="select"
                      size="sm"
                      className={cn(PERIOD_YEAR_SELECT_CLASS, PERIOD_SELECT_CLASS)}
                      value={panelYearA}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        onPanelYearAChange(Number(e.target.value))
                      }
                      aria-label={t('dashboardWeeklySalesPeriodAYear')}
                    >
                      {weeklyYearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </Input>
                  </div>
                </th>
                <th className="border border-noorix-border px-2 py-2 text-center align-bottom">
                  <div className="mb-0.5 text-[11px] font-bold leading-snug text-noorix-text">{t('dashboardWeeklySalesPeriodCompareHeader')}</div>
                  <div className="mb-1 text-[10px] font-semibold text-noorix-muted">{t('dashboardWeeklySalesAvgDailyShort')}</div>
                  <div className={PERIOD_CONTROLS_WRAP}>
                    <Input
                      type="select"
                      size="sm"
                      className={cn(PERIOD_MONTH_SELECT_CLASS, PERIOD_SELECT_CLASS)}
                      value={panelMonthB}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        onPanelMonthBChange(Number(e.target.value))
                      }
                      aria-label={t('dashboardWeeklySalesPeriodBColumn')}
                    >
                      {weeklyMonthOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Input>
                    <Input
                      type="select"
                      size="sm"
                      className={cn(PERIOD_YEAR_SELECT_CLASS, PERIOD_SELECT_CLASS)}
                      value={panelYearB}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        onPanelYearBChange(Number(e.target.value))
                      }
                      aria-label={t('dashboardWeeklySalesPeriodBYear')}
                    >
                      {weeklyYearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </Input>
                  </div>
                </th>
                <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold">
                  {t('dashboardWeeklySalesDelta')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.weekIndex} className="bg-[var(--noorix-surface-1)]">
                  <td className="border border-noorix-border px-2 py-2 text-center text-[13px] font-medium text-noorix-text">
                    {t('dashboardWeeklySalesWeekRange', {
                      n: row.weekIndex,
                      from: row.dayStart,
                      to: row.dayEnd,
                    })}
                  </td>
                  <td className="border border-noorix-border px-2 py-2 text-center" dir="ltr">
                    <FmtNum
                      n={row.avgDailyCurrent}
                      maxDecimals={2}
                      className="font-semibold tabular-nums nx-font-numbers text-noorix-text"
                    />{' '}
                    <span className="nx-sar text-[11px] text-noorix-muted">SR</span>
                  </td>
                  <td className="border border-noorix-border px-2 py-2 text-center" dir="ltr">
                    <FmtNum
                      n={row.avgDailyBaseline}
                      maxDecimals={2}
                      className="font-semibold tabular-nums nx-font-numbers text-noorix-text"
                    />{' '}
                    <span className="nx-sar text-[11px] text-noorix-muted">SR</span>
                  </td>
                  <td className="border border-noorix-border px-2 py-2 text-center">
                    {row.deltaPct != null ? (
                      <span
                        className={cn(
                          'text-[13px] font-bold tabular-nums nx-font-numbers',
                          row.deltaPct > 0 ? 'text-[#3B6D11]' : row.deltaPct < 0 ? 'text-[#A32D2D]' : 'text-noorix-muted',
                        )}
                        dir="ltr"
                      >
                        {row.deltaPct > 0 ? '+' : ''}
                        {Math.round(row.deltaPct * 10) / 10}%
                      </span>
                    ) : (
                      <span className="text-[13px] font-semibold text-noorix-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
