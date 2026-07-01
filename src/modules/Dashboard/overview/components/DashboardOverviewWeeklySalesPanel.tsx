/**
 * متوسط يومي المبيعات لكل جزء أسبوعي داخل الشهر (1–7، 8–14، …) مقارنة بمرجع.
 */
import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { FmtNum, Input } from '../../../../ui';
import { cn } from '../../../../ui/cn';

/** قوائم شهر/سنة مضغوطة — أنماط في index.css (.nx-dashboard-period-select) */
const PERIOD_CONTROLS_WRAP = 'inline-flex flex-row flex-wrap items-center justify-center gap-1';

const COL_WEEK = '24%';
const COL_CURRENT = '28%';
const COL_BASELINE = '28%';
const COL_DELTA = '20%';

const TH_CELL =
  'border border-noorix-border bg-[var(--noorix-table-header-bg)] px-1 py-1.5 text-center text-[9px] font-bold leading-tight text-white sm:px-2 sm:py-2.5 sm:text-xs';
const TD_CELL =
  'border border-noorix-border px-1 py-1.5 text-center text-[10px] leading-tight sm:px-2 sm:py-2 sm:text-[13px]';

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
    <section className="noorix-surface-card min-w-0 overflow-hidden p-0" aria-label={t('dashboardWeeklySalesTitle')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-noorix-border bg-noorix-bg-muted/40 px-2 py-2.5 sm:gap-3 sm:px-3 sm:py-3">
        <span className="h-7 w-1 shrink-0 rounded-full bg-noorix-blue sm:h-8" aria-hidden />
        <h2 className="m-0 min-w-0 flex-1 text-[12px] font-bold leading-snug text-noorix-text sm:text-[13px]">
          {t('dashboardWeeklySalesTitle')}
        </h2>
      </div>

      <div className="p-3 sm:p-4">
        {isLoading || !data ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--noorix-surface-2)]" />
            ))}
          </div>
        ) : (
          <table className="w-full table-fixed border-collapse overflow-hidden rounded-lg border border-noorix-border text-[10px]">
            <colgroup>
              <col style={{ width: COL_WEEK }} />
              <col style={{ width: COL_CURRENT }} />
              <col style={{ width: COL_BASELINE }} />
              <col style={{ width: COL_DELTA }} />
            </colgroup>
            <thead>
              <tr>
                <th className={TH_CELL}>
                  {t('dashboardWeeklySalesWeekCol')}
                </th>
                <th className={cn(TH_CELL, 'align-bottom')}>
                  <div className="mb-0.5 text-[9px] font-bold leading-tight text-noorix-text sm:text-[11px]">
                    {t('dashboardWeeklySalesPeriodMainHeader')}
                  </div>
                  <div className="mb-1 text-[8px] font-semibold text-noorix-muted sm:text-[10px]">
                    {t('dashboardWeeklySalesAvgDailyShort')}
                  </div>
                  <div className={PERIOD_CONTROLS_WRAP}>
                    <Input
                      type="select"
                      size="sm"
                      containerClassName="!gap-0 w-auto shrink-0"
                      className="nx-dashboard-period-select nx-dashboard-period-select--month"
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
                      containerClassName="!gap-0 w-auto shrink-0"
                      className="nx-dashboard-period-select nx-dashboard-period-select--year"
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
                <th className={cn(TH_CELL, 'align-bottom')}>
                  <div className="mb-0.5 text-[9px] font-bold leading-tight text-noorix-text sm:text-[11px]">
                    {t('dashboardWeeklySalesPeriodCompareHeader')}
                  </div>
                  <div className="mb-1 text-[8px] font-semibold text-noorix-muted sm:text-[10px]">
                    {t('dashboardWeeklySalesAvgDailyShort')}
                  </div>
                  <div className={PERIOD_CONTROLS_WRAP}>
                    <Input
                      type="select"
                      size="sm"
                      containerClassName="!gap-0 w-auto shrink-0"
                      className="nx-dashboard-period-select nx-dashboard-period-select--month"
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
                      containerClassName="!gap-0 w-auto shrink-0"
                      className="nx-dashboard-period-select nx-dashboard-period-select--year"
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
                <th className={TH_CELL}>
                  {t('dashboardWeeklySalesDelta')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.weekIndex} className="bg-[var(--noorix-surface-1)]">
                  <td className={cn(TD_CELL, 'font-medium text-noorix-text')}>
                    {t('dashboardWeeklySalesWeekRange', {
                      n: row.weekIndex,
                      from: row.dayStart,
                      to: row.dayEnd,
                    })}
                  </td>
                  <td className={TD_CELL} dir="ltr">
                    <FmtNum
                      n={row.avgDailyCurrent}
                      maxDecimals={2}
                      className="font-semibold tabular-nums nx-font-numbers text-noorix-text"
                    />{' '}
                    <span className="nx-sar text-[8px] text-noorix-muted sm:text-[11px]">SR</span>
                  </td>
                  <td className={TD_CELL} dir="ltr">
                    <FmtNum
                      n={row.avgDailyBaseline}
                      maxDecimals={2}
                      className="font-semibold tabular-nums nx-font-numbers text-noorix-text"
                    />{' '}
                    <span className="nx-sar text-[8px] text-noorix-muted sm:text-[11px]">SR</span>
                  </td>
                  <td className={TD_CELL}>
                    {row.deltaPct != null ? (
                      <span
                        className={cn(
                          'font-bold tabular-nums nx-font-numbers',
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
