import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { FmtNum, SimpleTable, cn } from '../../../../ui';
import { DateFilterMonthPicker } from '../../../../ui/date';

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

function MonthHeader({
  title,
  subtitle,
  monthLabel,
  year,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  monthLabel: React.ReactNode;
  year: number;
}) {
  return (
    <>
      <div className="mb-0.5 text-[9px] font-bold leading-tight text-white sm:text-[11px]">
        {title}
      </div>
      <div className="mb-1 text-[8px] font-semibold text-white/75 sm:text-[10px]">
        {subtitle}
      </div>
      <div className="text-[8px] font-bold text-white/80 sm:text-[10px]">
        {monthLabel} {year}
      </div>
    </>
  );
}

function MoneyCell({ value }: { value: number }) {
  return (
    <span dir="ltr">
      <FmtNum
        n={value}
        maxDecimals={2}
        className="font-semibold tabular-nums nx-font-numbers text-noorix-text"
      />{' '}
      <span className="nx-sar text-[8px] text-noorix-muted sm:text-[11px]">SR</span>
    </span>
  );
}

function DeltaCell({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-[13px] font-semibold text-noorix-muted">-</span>;
  }

  return (
    <span
      className={cn(
        'font-bold tabular-nums nx-font-numbers',
        value > 0 ? 'text-[#3B6D11]' : value < 0 ? 'text-[#A32D2D]' : 'text-noorix-muted',
      )}
      dir="ltr"
    >
      {value > 0 ? '+' : ''}
      {Math.round(value * 10) / 10}%
    </span>
  );
}

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
  const monthALabel = weeklyMonthOptions.find((option) => option.value === panelMonthA)?.label;
  const monthBLabel = weeklyMonthOptions.find((option) => option.value === panelMonthB)?.label;

  return (
    <section className="noorix-surface-card min-w-0 overflow-hidden p-0" aria-label={t('dashboardWeeklySalesTitle')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-noorix-border bg-noorix-bg-muted/40 px-2 py-2.5 sm:gap-3 sm:px-3 sm:py-3">
        <span className="h-7 w-1 shrink-0 rounded-full bg-noorix-blue sm:h-8" aria-hidden />
        <h2 className="m-0 min-w-0 flex-1 text-[12px] font-bold leading-snug text-noorix-text sm:text-[13px]">
          {t('dashboardWeeklySalesTitle')}
        </h2>
        <span className="shrink-0 rounded bg-noorix-bg-muted px-2 py-1 text-[10px] font-bold text-noorix-muted">
          {t('reportAmountBasisGrossShort')}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex min-w-0 flex-col items-center justify-center gap-3 sm:flex-row">
          <DateFilterMonthPicker
            label={t('dashboardWeeklySalesPeriodMainHeader')}
            ariaLabel={t('dashboardWeeklySalesPeriodAColumn')}
            years={weeklyYearOptions}
            year={panelYearA}
            month={panelMonthA}
            onChange={({ year, month }) => {
              onPanelYearAChange(year);
              onPanelMonthAChange(month);
            }}
            className="ndfb-month-picker--dashboard"
          />
          <DateFilterMonthPicker
            label={t('dashboardWeeklySalesPeriodCompareHeader')}
            ariaLabel={t('dashboardWeeklySalesPeriodBColumn')}
            years={weeklyYearOptions}
            year={panelYearB}
            month={panelMonthB}
            onChange={({ year, month }) => {
              onPanelYearBChange(year);
              onPanelMonthBChange(month);
            }}
            className="ndfb-month-picker--dashboard"
          />
        </div>

        {isLoading || !data ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-10 animate-pulse rounded-lg bg-[var(--noorix-surface-2)]" />
            ))}
          </div>
        ) : (
          <SimpleTable<WeeklySalesWeekRow>
            compact
            tableClassName="table-fixed overflow-hidden rounded-lg border border-noorix-border text-[10px]"
            frameClassName="border-0"
            cellPadding="6px 8px"
            columns={[
              {
                key: 'weekIndex',
                label: t('dashboardWeeklySalesWeekCol'),
                width: '24%',
                headerClassName: TH_CELL,
                cellClassName: cn(TD_CELL, 'font-medium text-noorix-text'),
                render: (_value, row) => t('dashboardWeeklySalesWeekRange', {
                  n: row.weekIndex,
                  from: row.dayStart,
                  to: row.dayEnd,
                }),
              },
              {
                key: 'avgDailyCurrent',
                label: (
                  <MonthHeader
                    title={t('dashboardWeeklySalesPeriodMainHeader')}
                    subtitle={t('dashboardWeeklySalesAvgDailyShort')}
                    monthLabel={monthALabel}
                    year={panelYearA}
                  />
                ),
                width: '28%',
                headerClassName: cn(TH_CELL, 'align-bottom'),
                cellClassName: TD_CELL,
                render: (_value, row) => <MoneyCell value={row.avgDailyCurrent} />,
              },
              {
                key: 'avgDailyBaseline',
                label: (
                  <MonthHeader
                    title={t('dashboardWeeklySalesPeriodCompareHeader')}
                    subtitle={t('dashboardWeeklySalesAvgDailyShort')}
                    monthLabel={monthBLabel}
                    year={panelYearB}
                  />
                ),
                width: '28%',
                headerClassName: cn(TH_CELL, 'align-bottom'),
                cellClassName: TD_CELL,
                render: (_value, row) => <MoneyCell value={row.avgDailyBaseline} />,
              },
              {
                key: 'deltaPct',
                label: t('dashboardWeeklySalesDelta'),
                width: '20%',
                headerClassName: TH_CELL,
                cellClassName: TD_CELL,
                render: (_value, row) => <DeltaCell value={row.deltaPct} />,
              },
            ]}
            data={data.rows}
            getRowClassName={() => 'bg-[var(--noorix-surface-1)]'}
          />
        )}
      </div>
    </section>
  );
}
