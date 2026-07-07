import React from 'react';
import { Button, DateMonthScopePicker, FilterToolbar, Input, MetricCard, cn } from '../../ui';
import GeneralPlTable from './GeneralPlTable';
import type { PlDisplayLevel } from './reportHelpers';
import type { GeneralProfitLossReport, PlDisplayRow, ReportDetailState, ReportPeriodMode } from './reportTypes';
import { buildProfitLossKpiCards, getProfitLossMonthNames } from './profitLossPresentationModel';

type ProfitLossReportWorkspaceProps = {
  activeCompanyId: string | number | null | undefined;
  companyName: string;
  report: GeneralProfitLossReport | undefined;
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
  isPlaceholderData: boolean;
  year: number;
  yearOptions: number[];
  periodMode: ReportPeriodMode;
  selectedMonth: string;
  selectedMonthNumber: number | null;
  visibleRows: PlDisplayRow[];
  flatRowsCount: number;
  collapsedGroups: Record<string, boolean>;
  plDisplayLevel: PlDisplayLevel;
  rowSearch: string;
  isMobile: boolean;
  lang: string;
  t: (key: string) => string;
  onYearChange: (year: number) => void;
  onPeriodModeChange: (mode: ReportPeriodMode) => void;
  onSelectedMonthChange: (month: string) => void;
  onDisplayLevelChange: (level: PlDisplayLevel) => void;
  onRowSearchChange: (value: string) => void;
  onToggleGroup: (key: string) => void;
  onOpenDetail: (payload: ReportDetailState) => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onPrint: () => void;
};

export default function ProfitLossReportWorkspace({
  activeCompanyId,
  companyName,
  report,
  isLoading,
  error,
  isFetching,
  isPlaceholderData,
  year,
  yearOptions,
  periodMode,
  selectedMonth,
  selectedMonthNumber,
  visibleRows,
  flatRowsCount,
  collapsedGroups,
  plDisplayLevel,
  rowSearch,
  isMobile,
  lang,
  t,
  onYearChange,
  onPeriodModeChange,
  onSelectedMonthChange,
  onDisplayLevelChange,
  onRowSearchChange,
  onToggleGroup,
  onOpenDetail,
  onExportExcel,
  onExportPdf,
  onPrint,
}: ProfitLossReportWorkspaceProps) {
  const monthNames = getProfitLossMonthNames(lang);
  const activeMonthLabel = selectedMonthNumber ? monthNames[selectedMonthNumber - 1] : '';
  const periodLabel = selectedMonthNumber ? `${activeMonthLabel} ${year}` : String(year);
  const kpiCards = buildProfitLossKpiCards({ report, selectedMonthNumber, lang, year, t });
  const directionLabel = lang === 'en' ? 'VAT inclusive' : 'شامل الضريبة';
  const modeLabel = selectedMonthNumber ? t('reportPeriodMonth') : t('reportPeriodYear');

  return (
    <div className="nx-pl-workspace">
      <section className="nx-pl-command-center" aria-labelledby="general-pl-title">
        <div className="nx-pl-command-center__main">
          <div className="min-w-0">
            <div className="nx-pl-eyebrow">{t('reportIncomeStatementTitle')}</div>
            <h2 id="general-pl-title" className="nx-pl-command-center__title">
              {t('reportGeneral')}
            </h2>
            <div className="nx-pl-command-center__meta">
              {companyName && <span className="nx-pl-chip nx-pl-chip--strong">{companyName}</span>}
              <span className="nx-pl-chip">{periodLabel}</span>
              <span className="nx-pl-chip">{directionLabel}</span>
              <span className="nx-pl-chip">{modeLabel}</span>
              {isFetching && isPlaceholderData && <span className="nx-pl-chip nx-pl-chip--muted">{t('loading')}</span>}
            </div>
          </div>

          <FilterToolbar variant="bare" className="nx-pl-command-center__controls">
            <DateMonthScopePicker
              year={year}
              years={yearOptions}
              month={selectedMonth}
              mode={periodMode}
              allowAll={false}
              allowYear
              fallbackMonth={selectedMonthNumber || 1}
              onYearChange={onYearChange}
              onMonthChange={onSelectedMonthChange}
              onModeChange={(value) => onPeriodModeChange(value as ReportPeriodMode)}
            />
            <div className="nx-pl-actions">
              <Button size="sm" onClick={onExportExcel} disabled={!report}>
                {t('exportExcel')}
              </Button>
              <Button size="sm" onClick={onExportPdf} disabled={!report}>
                طباعة / PDF
              </Button>
              <Button size="sm" onClick={onPrint} disabled={!report}>
                {t('print')}
              </Button>
            </div>
          </FilterToolbar>
        </div>
      </section>

      {!activeCompanyId && <div className="noorix-surface-card p-5 text-center text-noorix-muted">{t('pleaseSelectCompany')}</div>}

      {activeCompanyId && (
        <>
          {report && (
            <section
              className={cn(
                'nx-pl-kpi-strip transition-opacity duration-200',
                isFetching && isPlaceholderData && 'pointer-events-none opacity-55',
              )}
            >
              {kpiCards.map((card) => (
                <MetricCard key={`${year}-${selectedMonthNumber || 'year'}-${card.key}`} color={card.color} className="nx-pl-kpi-card">
                  <MetricCard.Header label={card.label} />
                  <MetricCard.Value
                    value={card.value}
                    currency="SR"
                    color={card.isNegativeProfit ? 'var(--noorix-accent-red)' : undefined}
                  />
                  <MetricCard.Footer className="nx-pl-kpi-card__footer">
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-noorix-muted">{card.periodLabel}</span>
                    {card.profitPercent != null && (
                      <span
                        className={cn(
                          'nx-pl-margin-pill',
                          Number(card.profitPercent) > 0 && 'nx-pl-margin-pill--positive',
                          Number(card.profitPercent) < 0 && 'nx-pl-margin-pill--negative',
                          Number(card.profitPercent) === 0 && 'nx-pl-margin-pill--neutral',
                        )}
                      >
                        {t('reportProfitMargin')}: {card.profitPercent}%
                      </span>
                    )}
                  </MetricCard.Footer>
                </MetricCard>
              ))}
            </section>
          )}

          {isLoading && <div className="noorix-surface-card text-center text-noorix-muted p-6">{t('loading')}</div>}

          {error && (
            <div className="noorix-surface-card p-5 text-noorix-red bg-[var(--noorix-red-8)]">
              {error.message}
            </div>
          )}

          {!isLoading && !error && report && flatRowsCount === 0 && (
            <div className="noorix-surface-card text-center text-noorix-muted p-6">{t('reportNoData')}</div>
          )}

          {!isLoading && !error && report && visibleRows.length > 0 && (
            <section className="nx-pl-statement-shell">
              <div className="nx-pl-statement-head">
                <div>
                  <div className="nx-pl-eyebrow">{t('reportPlToolbarPeriod')}</div>
                  <h3 className="nx-pl-statement-title">{periodLabel}</h3>
                </div>
                <FilterToolbar variant="bare" className="nx-pl-statement-tools">
                  <div className="nx-pl-level-group">
                    {([1, 2, 3] as const).map((level) => (
                      <Button
                        key={level}
                        size="sm"
                        variant={plDisplayLevel === level ? 'primary' : 'default'}
                        type="button"
                        onClick={() => onDisplayLevelChange(level)}
                      >
                        {level === 1 ? t('reportPlLevel1') : level === 2 ? t('reportPlLevel2') : t('reportPlLevel3')}
                      </Button>
                    ))}
                  </div>
                  <Input
                    type="text"
                    size="sm"
                    className="nx-pl-row-search"
                    label={t('reportPlRowFilterPlaceholder')}
                    value={rowSearch}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => onRowSearchChange(event.target.value)}
                  />
                </FilterToolbar>
              </div>

              <GeneralPlTable
                report={report}
                visibleRows={visibleRows}
                collapsedGroups={collapsedGroups}
                toggleGroup={onToggleGroup}
                lang={lang}
                t={t}
                isMobile={isMobile}
                selectedMonthNumber={selectedMonthNumber}
                monthNames={monthNames}
                onOpenDetail={onOpenDetail}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
