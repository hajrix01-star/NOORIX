import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Button, FmtNum, SearchableOptionsPicker, SimpleTable, cn, type SearchableOption, type SimpleTableColumn } from '../../../../ui';
import type {
  DashboardSalesMetricWeeklyComparisonRow,
} from '../../../../types/api/domains/dashboard';

type DashboardWeeklySalesComparisonData = {
  rows: DashboardSalesMetricWeeklyComparisonRow[];
};

type DashboardWeeklySalesComparisonRow = DashboardSalesMetricWeeklyComparisonRow;

const TH_CELL =
  'border border-noorix-border bg-[var(--noorix-table-header-bg)] px-1.5 py-2 text-center text-[12px] font-bold leading-tight text-white sm:px-2.5 sm:py-2.5 sm:text-[13px]';
const TD_CELL =
  'border border-noorix-border px-1.5 py-2 text-center text-[13px] leading-tight sm:px-2.5 sm:py-2.5 sm:text-[14px]';

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
  data: DashboardWeeklySalesComparisonData | null;
  isLoading: boolean;
};

type MonthDraft = {
  year: number;
  month: number;
};

function MonthHeader({
  subtitle,
  monthLabel,
  year,
}: {
  subtitle: React.ReactNode;
  monthLabel: React.ReactNode;
  year: number;
}) {
  return (
    <>
      <div className="mb-0.5 text-[12px] font-bold leading-tight text-white sm:text-[13px]">
        {monthLabel} {year}
      </div>
      <div className="text-[11px] font-semibold text-white/75 sm:text-[12px]">
        {subtitle}
      </div>
    </>
  );
}

function MoneyCell({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="font-semibold text-noorix-muted">-</span>;
  }
  return (
    <span dir="ltr">
      <FmtNum
        n={value}
        className="font-semibold tabular-nums nx-font-numbers text-noorix-text"
      />
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

function MonthSelector({
  title,
  draft,
  yearOptions,
  monthOptions,
  onChange,
}: {
  title: string;
  draft: MonthDraft;
  yearOptions: readonly number[];
  monthOptions: ReadonlyArray<{ value: number; label: string }>;
  onChange: (draft: MonthDraft) => void;
}) {
  const yearPickerOptions: SearchableOption[] = yearOptions.map((year) => ({
    value: String(year),
    label: String(year),
  }));
  const monthPickerOptions: SearchableOption[] = monthOptions.map((option) => ({
    value: String(option.value),
    label: option.label,
  }));

  return (
    <div className="grid min-w-[min(100%,18rem)] grid-cols-2 gap-2 rounded-lg border border-noorix-border bg-noorix-surface p-2">
      <div className="col-span-2 text-center text-[12px] font-semibold text-noorix-muted">
        {title}
      </div>
      <SearchableOptionsPicker
        size="sm"
        aria-label={`${title} year`}
        options={yearPickerOptions}
        value={String(draft.year)}
        onChange={(value) => onChange({ ...draft, year: Number(value) })}
      />
      <SearchableOptionsPicker
        size="sm"
        aria-label={`${title} month`}
        options={monthPickerOptions}
        value={String(draft.month)}
        onChange={(value) => onChange({ ...draft, month: Number(value) })}
      />
    </div>
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
  const [draftA, setDraftA] = useState<MonthDraft>(() => ({ year: panelYearA, month: panelMonthA }));
  const [draftB, setDraftB] = useState<MonthDraft>(() => ({ year: panelYearB, month: panelMonthB }));
  const hasDraftChanges =
    draftA.year !== panelYearA ||
    draftA.month !== panelMonthA ||
    draftB.year !== panelYearB ||
    draftB.month !== panelMonthB;

  useEffect(() => {
    setDraftA({ year: panelYearA, month: panelMonthA });
    setDraftB({ year: panelYearB, month: panelMonthB });
  }, [panelMonthA, panelMonthB, panelYearA, panelYearB]);

  const applyDraft = () => {
    if (draftA.year !== panelYearA) onPanelYearAChange(draftA.year);
    if (draftA.month !== panelMonthA) onPanelMonthAChange(draftA.month);
    if (draftB.year !== panelYearB) onPanelYearBChange(draftB.year);
    if (draftB.month !== panelMonthB) onPanelMonthBChange(draftB.month);
  };

  const columns = useMemo<SimpleTableColumn<DashboardWeeklySalesComparisonRow>[]>(
    () => [
      {
        key: 'weekIndex',
        label: t('dashboardWeeklySalesWeekCol'),
        headerClassName: TH_CELL,
        cellClassName: cn(TD_CELL, 'font-medium text-noorix-text'),
        render: (_value: unknown, row: DashboardWeeklySalesComparisonRow) => t('dashboardWeeklySalesWeekRange', {
          n: row.weekIndex,
          from: row.dayStart,
          to: row.dayEnd,
        }),
      },
      {
        key: 'avgDailyCurrent',
        label: (
          <MonthHeader
            subtitle={t('dashboardWeeklySalesAvgDailyShort')}
            monthLabel={monthALabel}
            year={panelYearA}
          />
        ),
        headerClassName: cn(TH_CELL, 'align-bottom'),
        cellClassName: TD_CELL,
        render: (_value: unknown, row: DashboardWeeklySalesComparisonRow) => <MoneyCell value={row.avgDailyCurrent} />,
      },
      {
        key: 'avgDailyBaseline',
        label: (
          <MonthHeader
            subtitle={t('dashboardWeeklySalesAvgDailyShort')}
            monthLabel={monthBLabel}
            year={panelYearB}
          />
        ),
        headerClassName: cn(TH_CELL, 'align-bottom'),
        cellClassName: TD_CELL,
        render: (_value: unknown, row: DashboardWeeklySalesComparisonRow) => <MoneyCell value={row.avgDailyBaseline} />,
      },
      {
        key: 'deltaPct',
        label: t('dashboardWeeklySalesDelta'),
        headerClassName: TH_CELL,
        cellClassName: TD_CELL,
        render: (_value: unknown, row: DashboardWeeklySalesComparisonRow) => <DeltaCell value={row.deltaPct} />,
      },
    ],
    [monthALabel, monthBLabel, panelYearA, panelYearB, t],
  );

  return (
    <section className="noorix-surface-card min-w-0 overflow-hidden p-0" aria-label={t('dashboardWeeklySalesTitle')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-noorix-border bg-noorix-bg-muted/40 px-2 py-2.5 sm:gap-3 sm:px-3 sm:py-3">
        <span className="h-7 w-1 shrink-0 rounded-full bg-noorix-blue sm:h-8" aria-hidden />
        <h2 className="m-0 min-w-0 flex-1 text-[15px] font-bold leading-snug text-noorix-text sm:text-[16px]">
          {t('dashboardWeeklySalesTitle')}
        </h2>
        <span className="shrink-0 rounded bg-noorix-bg-muted px-2.5 py-1 text-[12px] font-bold text-noorix-muted">
          {t('reportAmountBasisGrossShort')}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 grid min-w-0 grid-cols-1 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <MonthSelector
            title={t('dashboardWeeklySalesPeriodMainHeader')}
            draft={draftA}
            yearOptions={weeklyYearOptions}
            monthOptions={weeklyMonthOptions}
            onChange={setDraftA}
          />
          <MonthSelector
            title={t('dashboardWeeklySalesPeriodCompareHeader')}
            draft={draftB}
            yearOptions={weeklyYearOptions}
            monthOptions={weeklyMonthOptions}
            onChange={setDraftB}
          />
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={applyDraft}
            disabled={!hasDraftChanges}
            className="h-10 min-w-24"
          >
            {t('dateFilterApply')}
          </Button>
        </div>

        {isLoading || !data ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-10 animate-pulse rounded-lg bg-[var(--noorix-surface-2)]" />
            ))}
          </div>
        ) : (
          <SimpleTable<DashboardWeeklySalesComparisonRow>
            compact
            tableClassName="table-fixed overflow-hidden rounded-lg border border-noorix-border text-[13px]"
            frameClassName="border-0"
            cellPadding="6px 8px"
            columns={columns}
            data={data.rows}
            getRowClassName={() => 'bg-[var(--noorix-surface-1)]'}
          />
        )}
      </div>
    </section>
  );
}
