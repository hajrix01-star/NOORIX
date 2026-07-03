import React, { type Dispatch, type SetStateAction } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Button, cn } from '../../../../ui';
import { formatCompactNumber } from '../../../../utils/money';
import { EmptyState } from '../../../../components/states';
import { DashboardAreaTooltip } from './DashboardOverviewChartTooltips';
import { DashboardOverviewBreakdownTable } from './DashboardOverviewBreakdownTable';

type SeriesRow = {
  key: string;
  label: string;
  color: string;
  gradId: string;
  disabled: boolean;
};

type ChannelRow = { name: string; value: number; pct: string };

type PerfRow = Record<string, string | number>;

type Props = {
  lang: string;
  timelineGrain: string;
  setTimelineGrain: Dispatch<SetStateAction<string>>;
  timelineMonthName: string;
  year: number;
  performanceData: PerfRow[];
  perfTotal: number;
  channelData: ChannelRow[];
  channelPeriodLabel: string;
  hiddenSeries: Set<string>;
  toggleSeries: (key: string) => void;
  SERIES: SeriesRow[];
  pieColors: readonly string[];
  uiDir: string;
};

export function DashboardOverviewTimelineSection({
  lang,
  timelineGrain,
  setTimelineGrain,
  timelineMonthName,
  year,
  performanceData,
  perfTotal,
  channelData,
  channelPeriodLabel,
  hiddenSeries,
  toggleSeries,
  SERIES,
  pieColors,
  uiDir,
}: Props) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'grid gap-5',
        channelData.length > 0 ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-1',
      )}
    >
      <div className="noorix-surface-card p-4 lg:p-5">
        <div className="flex flex-col gap-3 mb-4 max-lg:items-center lg:flex-row lg:items-start lg:justify-between lg:gap-3">
          <div className="min-w-0 max-lg:text-center lg:text-start">
            <div className="text-[14px] font-bold text-noorix-text">{t('dashboardSalesTimeline')}</div>
            <div className="text-[12px] text-noorix-muted mt-0.5">
              {timelineGrain === 'monthly' ? String(year) : `${timelineMonthName} — ${year}`}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap max-lg:justify-center">
            <div
              role="tablist"
              dir={uiDir}
              className="inline-flex shrink-0 items-stretch rounded-lg border border-noorix-border bg-noorix-bg-muted p-0.5"
            >
              <Button
                type="button"
                role="tab"
                aria-selected={timelineGrain === 'monthly'}
                variant="raw"
                size="auto"
                className={cn(
                  'min-h-9 rounded-md px-3 py-1.5 text-[12px] font-semibold sm:min-h-8 sm:py-1',
                  timelineGrain === 'monthly'
                    ? 'bg-noorix-surface text-noorix-text shadow-sm'
                    : 'text-noorix-muted hover:bg-noorix-surface/60 hover:text-noorix-text',
                )}
                data-active={timelineGrain === 'monthly' ? 'true' : 'false'}
                onClick={() => setTimelineGrain('monthly')}
              >
                {t('dashboardTimelineMonthly')}
              </Button>
              <Button
                type="button"
                role="tab"
                aria-selected={timelineGrain === 'daily'}
                variant="raw"
                size="auto"
                className={cn(
                  'min-h-9 rounded-md px-3 py-1.5 text-[12px] font-semibold sm:min-h-8 sm:py-1',
                  timelineGrain === 'daily'
                    ? 'bg-noorix-surface text-noorix-text shadow-sm'
                    : 'text-noorix-muted hover:bg-noorix-surface/60 hover:text-noorix-text',
                )}
                data-active={timelineGrain === 'daily' ? 'true' : 'false'}
                onClick={() => setTimelineGrain('daily')}
              >
                {t('dashboardTimelineDaily')}
              </Button>
            </div>
            {SERIES.map((s) => {
              const hidden = hiddenSeries.has(s.key);
              const disabled = s.disabled;
              const seriesStyle = {
                '--dashboard-series-color': s.color,
              } as React.CSSProperties;
              return (
                <Button
                  key={s.key}
                  type="button"
                  variant="raw"
                  size="auto"
                  onClick={() => !disabled && toggleSeries(s.key)}
                  title={
                    disabled ? (lang === 'ar' ? 'بيانات يومية غير متاحة' : 'Daily data unavailable') : undefined
                  }
                  style={seriesStyle}
                  className={cn(
                    'dashboard-series-toggle flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-600 rounded border transition-all duration-150 select-none',
                    hidden && 'dashboard-series-toggle--hidden',
                    disabled && 'dashboard-series-toggle--disabled',
                  )}
                >
                  <span
                    className="dashboard-series-toggle__dot inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  />
                  {s.label}
                </Button>
              );
            })}
          </div>
        </div>

        {performanceData.length === 0 || perfTotal === 0 ? (
          <EmptyState
            className="h-[220px]"
            icon={
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
          >
            {t('noDataInPeriod')}
          </EmptyState>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={performanceData}
              margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
              barCategoryGap={timelineGrain === 'monthly' ? '22%' : '12%'}
              barGap={3}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" opacity={0.6} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)', fontFamily: 'var(--noorix-font-primary)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(n: number) => formatCompactNumber(n, lang)}
                tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={46}
              />
              <Tooltip content={(tp) => <DashboardAreaTooltip {...(tp as any)} lang={lang} />} />
              {SERIES.map((s) =>
                !hiddenSeries.has(s.key) && !s.disabled ? (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={s.color}
                    fillOpacity={0.9}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={timelineGrain === 'monthly' ? 28 : 12}
                  />
                ) : null,
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {channelData.length > 0 && (
        <div className="noorix-surface-card flex flex-col p-4 max-lg:items-center lg:p-5">
          <div className="mb-1 w-full text-[14px] font-bold text-noorix-text max-lg:text-center lg:text-start">
            {t('reportChannels')}
          </div>
          <div className="mb-4 w-full text-[12px] text-noorix-muted max-lg:text-center lg:text-start">
            {channelPeriodLabel}
          </div>

          <DashboardOverviewBreakdownTable
            className="w-full"
            labelHeader={t('reportChannels')}
            rows={channelData.map((ch, i) => ({
              key: ch.name,
              label: ch.name,
              amount: ch.value,
              pct: ch.pct,
              color: pieColors[i % pieColors.length],
            }))}
            t={t}
          />
        </div>
      )}
    </div>
  );
}
