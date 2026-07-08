/**
 * DashboardAppSalesTab — متابعة نسبة التطبيقات من المبيعات شهرياً + أداء كل قناة
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useDashboardSalesPack } from '../../../hooks/useDashboardSalesPack';
import { fmt } from '../../../utils/format';
import { FilterToolbar, SearchableOptionsPicker, SmartTable, FmtNum, type SmartTableFooterSegment } from '../../../ui';
import { LoadingState, EmptyState } from '../../../components/states';
import {
  buildAppSalesTableFooter,
  buildDashboardAppSalesModelFromMetrics,
  buildDashboardAppSalesYearSpanOptions,
  parseDashboardAppSalesYearSpan,
  type DashboardAppSalesYearSpan,
} from '../utils/dashboardAppSalesData';
import { DashboardAppSalesChart } from './DashboardAppSalesChart';
import type { DashboardSalesPackMetrics } from '../../../types/api/domains/dashboard';

type Props = {
  companyId: string | null | undefined;
  year: number;
};

const EMPTY_METRICS: DashboardSalesPackMetrics = {
  yearDaily: [],
  yearChannels: [],
  dailyDaily: [],
  dailyChannels: [],
  monthDaily: [],
};

export default function DashboardAppSalesTab({ companyId, year }: Props) {
  const { t, lang } = useTranslation();
  const [yearsSpan, setYearsSpan] = useState<DashboardAppSalesYearSpan>(1);

  const yearEnd = year;
  const yearStart = yearEnd - yearsSpan + 1;

  const { metrics, isLoading } = useDashboardSalesPack({
    companyId: companyId || '',
    yearStart: `${yearStart}-01-01`,
    yearEnd: `${yearEnd}-12-31`,
    dailyStart: null,
    dailyEnd: null,
    monthStart: null,
    monthEnd: null,
    enabled: !!companyId,
  });
  const salesMetrics = metrics ?? EMPTY_METRICS;

  const model = useMemo(
    () => buildDashboardAppSalesModelFromMetrics(salesMetrics.yearDaily, salesMetrics.yearChannels, lang, yearEnd, yearsSpan),
    [salesMetrics.yearDaily, salesMetrics.yearChannels, lang, yearEnd, yearsSpan],
  );

  const periodLabel = useMemo(() => {
    if (yearsSpan === 1) return String(yearEnd);
    return `${yearStart} — ${yearEnd}`;
  }, [yearStart, yearEnd, yearsSpan]);

  const tableFooter = useMemo(() => buildAppSalesTableFooter(model), [model]);
  const yearsSpanOptions = useMemo(() => buildDashboardAppSalesYearSpanOptions(t), [t]);

  const footerRow = useMemo((): SmartTableFooterSegment[] | null => {
    if (!model.channels.length) return null;
    const monthSegments: SmartTableFooterSegment[] = model.monthSeries.map((p) => {
      const cell = tableFooter.monthCells.find((c) => c.periodKey === p.periodKey);
      return {
        keys: [p.periodKey],
        content: cell?.hasData ? (
          <span className="nx-font-numbers font-bold text-nx-app">{fmt(cell.appPercent, 1)}%</span>
        ) : (
          <span className="text-noorix-muted">—</span>
        ),
      };
    });
    return [
      {
        keys: ['name'],
        content: <span className="font-bold text-noorix-text">{t('dashboardAppSalesTotalRow')}</span>,
      },
      ...monthSegments,
      {
        keys: ['periodPercent'],
        content: tableFooter.hasPeriodData ? (
          <span className="nx-font-numbers font-bold text-nx-app">{fmt(tableFooter.periodPercent, 1)}%</span>
        ) : (
          <span className="text-noorix-muted">—</span>
        ),
      },
    ];
  }, [model.channels.length, model.monthSeries, tableFooter, t]);

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
        <FilterToolbar variant="bare" className="flex items-center gap-2">
          <span className="text-[12px] text-noorix-muted">{t('dashboardAppSalesYearsSpan')}</span>
          <div className="w-[150px]">
            <SearchableOptionsPicker
              size="sm"
              value={String(yearsSpan)}
              onChange={(value) => setYearsSpan(parseDashboardAppSalesYearSpan(value))}
              options={yearsSpanOptions}
              aria-label={t('dashboardAppSalesYearsSpan')}
            />
          </div>
        </FilterToolbar>
      </div>

      <div className="noorix-surface-card p-3 sm:p-4 lg:p-5">
        <div className="mb-1 text-[14px] font-bold text-noorix-text max-lg:text-center lg:text-start">
          {t('dashboardAppSalesChart')}
        </div>
        <div className="mb-3 text-[12px] text-noorix-muted max-lg:text-center lg:text-start">
          {t('dashboardAppSalesPctOfSales')}
        </div>
        <div dir="ltr" className="w-full min-w-0">
          <DashboardAppSalesChart data={model.monthSeries} />
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
            footerRow={footerRow}
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
