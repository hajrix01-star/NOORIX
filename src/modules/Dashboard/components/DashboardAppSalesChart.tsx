/**
 * رسم نسبة التطبيقات شهرياً — تمرير أفقي على الجوال + تسميات مختصرة.
 */
import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
  Cell,
} from 'recharts';
import { useTranslation } from '../../../i18n/useTranslation';
import { useIsNarrow768 } from '../../../hooks/useMediaQuery';
import { VAULT_RECHARTS_COLORS } from '../../../constants/kpiCardTheme';
import { fmt } from '../../../utils/format';
import { FmtNum } from '../../../ui';
import { cn } from '../../../ui/cn';
import type { AppSalesMonthPoint } from '../utils/dashboardAppSalesData';

const APP_COLOR = VAULT_RECHARTS_COLORS.app;
const EMPTY_BAR = '#d4d4d8';
const Y_AXIS_W = 40;
const CHART_H_NARROW = 248;
const CHART_H_WIDE = 272;
const APP_LABEL_STYLE_NARROW: React.CSSProperties = {
  fontSize: 9,
  fill: 'var(--noorix-text)',
  fontFamily: 'var(--noorix-font-numbers)',
  fontWeight: 600,
};
const APP_LABEL_STYLE_WIDE: React.CSSProperties = {
  ...APP_LABEL_STYLE_NARROW,
  fontSize: 10,
};

type Props = {
  data: AppSalesMonthPoint[];
};

export function DashboardAppSalesChart({ data }: Props) {
  const { t } = useTranslation();
  const isNarrow = useIsNarrow768();

  const slotWidth = isNarrow ? 46 : 38;
  const needsScroll = isNarrow || data.length > 14;
  const chartMinWidth = needsScroll ? data.length * slotWidth + Y_AXIS_W + 24 : undefined;

  const xKey = isNarrow || data.length > 12 ? 'shortLabel' : 'label';
  const chartHeight = isNarrow ? CHART_H_NARROW : CHART_H_WIDE;

  const yMax = useMemo(() => {
    const peak = Math.max(0, ...data.map((d) => d.appPercent));
    if (peak <= 0) return 10;
    return Math.min(100, Math.ceil(peak * 1.12));
  }, [data]);

  const chart = (
    <BarChart
      data={data}
      margin={{
        top: 12,
        right: needsScroll ? 12 : 8,
        left: 4,
        bottom: 4,
      }}
      barCategoryGap={isNarrow ? '18%' : '22%'}
      barGap={2}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" opacity={0.55} vertical={false} />
      <XAxis
        dataKey={xKey}
        tick={{
          fontSize: isNarrow ? 10 : 11,
          fill: 'var(--noorix-text-muted)',
          fontFamily: 'var(--noorix-font-primary)',
        }}
        axisLine={false}
        tickLine={false}
        interval={0}
        minTickGap={isNarrow ? 4 : 8}
      />
      <YAxis
        tickFormatter={(v: number) => `${fmt(v, 0)}%`}
        tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
        axisLine={false}
        tickLine={false}
        width={Y_AXIS_W}
        domain={[0, yMax]}
        allowDecimals={false}
      />
      <Tooltip
        cursor={{ fill: 'color-mix(in srgb, var(--color-nx-app) 8%, transparent)' }}
        content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0]?.payload as AppSalesMonthPoint;
          return (
            <div className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2 text-[12px] shadow-md max-w-[220px]">
              <div className="font-bold text-noorix-text">{d.label}</div>
              <div className="mt-1 nx-font-numbers font-bold text-nx-app">{fmt(d.appPercent, 1)}%</div>
              <div className="mt-0.5 text-noorix-muted">
                <FmtNum n={d.app} /> / <FmtNum n={d.total} /> <span className="nx-sar">SR</span>
              </div>
            </div>
          );
        }}
      />
      <Bar dataKey="appPercent" radius={[5, 5, 0, 0]} maxBarSize={isNarrow ? 32 : 36} minPointSize={2}>
        {data.map((entry) => (
          <Cell key={entry.periodKey} fill={entry.appPercent > 0 ? APP_COLOR : EMPTY_BAR} />
        ))}
        <LabelList
          dataKey="appPercent"
          position="top"
          formatter={(v) => (Number(v) > 0 ? `${fmt(Number(v), 1)}%` : '')}
          style={isNarrow ? APP_LABEL_STYLE_NARROW : APP_LABEL_STYLE_WIDE}
        />
      </Bar>
    </BarChart>
  );

  return (
    <div className="flex flex-col gap-2">
      {needsScroll ? (
        <p className="text-[11px] text-noorix-muted text-center sm:text-start m-0">
          {t('dashboardAppSalesChartScrollHint')}
        </p>
      ) : null}
      <div
        className={cn(
          'w-full',
          needsScroll && 'overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]',
        )}
      >
        <div
          className="min-w-0"
          style={chartMinWidth != null ? { minWidth: chartMinWidth, height: chartHeight } : { height: chartHeight }}
        >
          <ResponsiveContainer width="100%" height="100%">
            {chart}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
