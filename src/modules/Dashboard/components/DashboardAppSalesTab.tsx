/**
 * DashboardAppSalesTab — متابعة نسبة التطبيقات من المبيعات شهرياً + أداء كل قناة
 */
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { useTranslation } from '../../../i18n/useTranslation';
import { useDashboardSalesPack } from '../../../hooks/useDashboardSalesPack';
import { VAULT_RECHARTS_COLORS } from '../../../constants/kpiCardTheme';
import { fmt } from '../../../utils/format';
import { Input, SmartTable, FmtNum } from '../../../ui';
import { LoadingState, EmptyState } from '../../../components/states';
import { buildDashboardAppSalesModel } from '../utils/dashboardAppSalesData';
const APP_COLOR = VAULT_RECHARTS_COLORS.app;
const YEARS_SPAN_OPTIONS = [1, 2, 3] as const;

type Props = {
  companyId: string | null | undefined;
  year: number;
};

export default function DashboardAppSalesTab({ companyId, year }: Props) {
  const { t, lang } = useTranslation();
  const [yearsSpan, setYearsSpan] = useState<(typeof YEARS_SPAN_OPTIONS)[number]>(1);

  const yearEnd = year;
  const yearStart = yearEnd - yearsSpan + 1;

  const { yearSummaries, isLoading } = useDashboardSalesPack({
    companyId: companyId || '',
    yearStart: `${yearStart}-01-01`,
    yearEnd: `${yearEnd}-12-31`,
    dailyStart: null,
    dailyEnd: null,
    monthStart: null,
    monthEnd: null,
    enabled: !!companyId,
  });

  const model = useMemo(
    () => buildDashboardAppSalesModel(yearSummaries, lang, yearEnd, yearsSpan),
    [yearSummaries, lang, yearEnd, yearsSpan],
  );

  const periodLabel = useMemo(() => {
    if (yearsSpan === 1) return String(yearEnd);
    return `${yearStart} — ${yearEnd}`;
  }, [yearStart, yearEnd, yearsSpan]);

  const tableColumns = useMemo(() => {
    const monthCols = model.monthSeries.map((p) => ({
      key: p.periodKey,
      label: p.label,
      numeric: true,
      width: 72,
      render: (_: unknown, row: (typeof model.channels)[0]) => {
        const cell = row.months[p.periodKey];
        if (!cell || cell.amount <= 0) {
          return <span className="text-noorix-muted">—</span>;
        }
        return (
          <span className="nx-font-numbers font-semibold text-noorix-text" title={`${fmt(cell.amount, 0)} SR`}>
            {fmt(cell.percent, 1)}%
          </span>
        );
      },
    }));

    return [
      {
        key: 'name',
        label: t('dashboardAppSalesColApp'),
        render: (_: unknown, row: (typeof model.channels)[0]) => (
          <span className="font-semibold text-noorix-text">{row.name}</span>
        ),
      },
      ...monthCols,
      {
        key: 'periodPercent',
        label: t('dashboardAppSalesColPeriod'),
        numeric: true,
        render: (_: unknown, row: (typeof model.channels)[0]) => (
          <span className="nx-font-numbers font-bold text-nx-app">{fmt(row.periodPercent, 1)}%</span>
        ),
      },
    ];
  }, [model.monthSeries, model.channels, t]);

  if (!companyId) {
    return (
      <div className="noorix-surface-card p-6 text-center text-noorix-muted">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="noorix-surface-card flex min-h-[240px] items-center justify-center p-8">
        <LoadingState />
      </div>
    );
  }

  if (!model.hasData) {
    return (
      <EmptyState className="noorix-surface-card p-12">
        {t('noDataInPeriod')}
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[13px] text-noorix-muted">{periodLabel}</span>
          <span className="text-[13px] text-noorix-muted">·</span>
          <span className="text-[13px] text-noorix-muted">{t('dashboardAppSalesPeriodTotal')}:</span>
          <span className="nx-font-numbers text-[15px] font-bold text-nx-app">
            {fmt(model.periodAppPercent, 1)}%
          </span>
          <span className="text-[12px] text-noorix-muted">
            (<FmtNum n={model.periodApp} /> / <FmtNum n={model.periodTotal} /> <span className="nx-sar">SR</span>)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-noorix-muted">{t('dashboardAppSalesYearsSpan')}</span>
          <Input
            type="select"
            size="sm"
            value={yearsSpan}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setYearsSpan(Number(e.target.value) as (typeof YEARS_SPAN_OPTIONS)[number])
            }
          >
            {YEARS_SPAN_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {t(n === 1 ? 'dashboardAppSalesYears1' : n === 2 ? 'dashboardAppSalesYears2' : 'dashboardAppSalesYears3')}
              </option>
            ))}
          </Input>
        </div>
      </div>

      <div className="noorix-surface-card p-4 lg:p-5">
        <div className="mb-1 text-[14px] font-bold text-noorix-text">{t('dashboardAppSalesChart')}</div>
        <div className="mb-4 text-[12px] text-noorix-muted">{t('dashboardAppSalesPctOfSales')}</div>
        <div dir="ltr" className="w-full">
          <ResponsiveContainer width="100%" height={Math.max(220, Math.min(360, model.monthSeries.length * 14))}>
            <BarChart
              data={model.monthSeries}
              margin={{ top: 8, right: 8, left: 0, bottom: model.monthSeries.length > 18 ? 56 : 36 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
                interval={model.monthSeries.length > 18 ? 1 : 0}
                angle={model.monthSeries.length > 12 ? -45 : 0}
                textAnchor={model.monthSeries.length > 12 ? 'end' : 'middle'}
                height={model.monthSeries.length > 12 ? 52 : 32}
              />
              <YAxis
                tickFormatter={(v: number) => `${fmt(v, 0)}%`}
                tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
                width={44}
                domain={[0, 'auto']}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as (typeof model.monthSeries)[0];
                  return (
                    <div className="rounded-md border border-noorix-border bg-noorix-surface px-3 py-2 text-[12px] shadow-md">
                      <div className="font-bold text-noorix-text">{d.label}</div>
                      <div className="mt-1 text-nx-app nx-font-numbers">{fmt(d.appPercent, 1)}%</div>
                      <div className="mt-0.5 text-noorix-muted">
                        <FmtNum n={d.app} /> / <FmtNum n={d.total} /> <span className="nx-sar">SR</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="appPercent" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {model.monthSeries.map((entry) => (
                  <Cell
                    key={entry.periodKey}
                    fill={entry.appPercent > 0 ? APP_COLOR : '#d4d4d8'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {model.channels.length > 0 && (
        <div className="noorix-surface-card overflow-hidden p-4 lg:p-5">
          <div className="mb-4 text-[14px] font-bold text-noorix-text">{t('dashboardAppSalesAppsTable')}</div>
          <SmartTable
            columns={tableColumns}
            data={model.channels}
            total={model.channels.length}
            pageSize={50}
            renderMobileCard={(row) => {
              const activeMonths = model.monthSeries.filter((p) => (row.months[p.periodKey]?.amount || 0) > 0);
              return (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-noorix-text">{row.name}</span>
                    <span className="nx-font-numbers font-bold text-nx-app">{fmt(row.periodPercent, 1)}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeMonths.slice(-6).map((p) => (
                      <div key={p.periodKey} className="rounded-lg bg-noorix-bg-muted px-2 py-1.5">
                        <div className="text-[10px] text-noorix-muted">{p.label}</div>
                        <div className="nx-font-numbers text-[13px] font-semibold">
                          {fmt(row.months[p.periodKey]?.percent ?? 0, 1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}

      {model.periodApp === 0 && (
        <p className="text-center text-[12px] font-semibold text-noorix-amber">{t('dashboardNoAppSales')}</p>
      )}
    </div>
  );
}
