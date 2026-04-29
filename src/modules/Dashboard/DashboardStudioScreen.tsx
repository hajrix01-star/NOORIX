/**
 * لوحة تحكم تجريبية — فلاتر إضافية، بيانات ورؤى أكثر من نظرة عامة التقليدية.
 * المسار: /dashboard-studio
 */
import React, { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useReportsGeneralProfitLoss } from '../../hooks/useReports';
import { Button, Input, ScreenShell } from '../../ui';
import { cn } from '../../ui/cn';
import { getSaudiNow } from '../../utils/saudiDate';
import {
  useDashboardOverviewModel,
  MONTH_NAMES_AR,
  MONTH_NAMES_EN,
} from './overview/hooks/useDashboardOverviewModel';
import { DashboardOverviewContent } from './overview/DashboardOverviewContent';
import { DashboardOverviewKpiSkeleton } from './overview/components/DashboardOverviewKpiSkeleton';
import { ErrorState } from '../../components/states';
import { buildDashboardStudioKpiCsv, buildDashboardStudioPeriodCsvAppend } from './utils/buildDashboardStudioCsv';
import { periodInvoiceKindLabel } from './utils/periodInvoiceKindLabels';
import { DashboardStudioPeriodSnapshot } from './studio/DashboardStudioPeriodSnapshot';
import { DashboardStudioInsightsPanel } from './studio/DashboardStudioInsightsPanel';
import { DashboardStudioCompareBlock } from './studio/DashboardStudioCompareBlock';

export default function DashboardStudioScreen() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const { activeCompanyId } = useApp();
  const now = getSaudiNow();
  const [year, setYear] = useState(now.year);
  const [selectedMonth, setSelectedMonth] = useState(String(now.month));
  const selectedMonthNumber = selectedMonth ? Number(selectedMonth) : null;
  const [includeCancelledSales, setIncludeCancelledSales] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  const filter = useMemo(
    () => ({
      year,
      selectedMonth: selectedMonthNumber,
      label: selectedMonthNumber
        ? `${MONTH_NAMES_EN[selectedMonthNumber - 1]} ${year}`
        : `${year}`,
    }),
    [year, selectedMonthNumber],
  );

  const modelOptions = useMemo(() => ({ includeCancelledSales }), [includeCancelledSales]);

  const m = useDashboardOverviewModel(activeCompanyId || '', year, selectedMonthNumber, filter, modelOptions);

  const compareAnnual = showCompare && selectedMonthNumber == null;
  const prevYearPl = useReportsGeneralProfitLoss({
    companyId: activeCompanyId || '',
    year: year - 1,
    enabled: !!activeCompanyId && compareAnnual && year > 2001,
  });

  const exportCsv = useCallback(() => {
    if (!m.report || m.isLoading || m.salesPackLoading) return;
    const kpi = buildDashboardStudioKpiCsv(m, {
      scopeLabel: t('dashboardStudioCsvScope'),
      metric: t('dashboardStudioCsvMetric'),
      value: t('dashboardStudioCsvValue'),
      pctOfSales: t('dashboardStudioCsvPctOfSales'),
    });
    const periodAppend = buildDashboardStudioPeriodCsvAppend(
      m,
      {
        section: t('dashboardStudioPeriodSnapshotTitle'),
        kind: t('dashboardStudioByInvoiceKind'),
        amount: t('dashboardStudioCsvValue'),
        count: t('dashboardStudioInvoiceCount'),
      },
      (kind) => periodInvoiceKindLabel(t, kind),
    );
    const cancelledNote = includeCancelledSales ? `\r\n${t('dashboardStudioIncludeCancelledNote')},1` : '';
    const text = kpi + (periodAppend ? `\r\n${periodAppend}` : '') + cancelledNote;
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const part = selectedMonthNumber != null ? String(selectedMonthNumber) : 'all';
    a.href = url;
    a.download = `noorix-dashboard-studio-${year}-${part}.csv`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [m, selectedMonthNumber, t, year, includeCancelledSales]);

  return (
    <ScreenShell>
      <div className="flex flex-col gap-5">
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border border-noorix-border bg-noorix-surface',
            'shadow-sm',
          )}
        >
          <div
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-noorix-blue via-emerald-500/80 to-amber-400/90"
            aria-hidden
          />
          <div className="p-4 md:p-5 pt-5">
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('dashboardStudioTitle')}</h1>
                  <span className="inline-flex items-center rounded-full border border-noorix-border bg-noorix-bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-noorix-muted">
                    {t('dashboardStudioBeta')}
                  </span>
                </div>
                <p className="text-[13px] text-noorix-muted mt-1.5 m-0 max-w-[56ch]">{t('dashboardStudioDesc')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/')}>
                  {t('dashboardStudioClassicLink')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={exportCsv}
                  disabled={!activeCompanyId || m.isLoading || m.salesPackLoading || !!m.error || !m.report}
                >
                  {t('dashboardStudioExportCsv')}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-start">
          <aside
            className={cn(
              'noorix-surface-card p-4 lg:sticky lg:top-4 lg:self-start',
              'border border-noorix-border/90 shadow-sm',
            )}
          >
            <div className="text-[12px] font-bold uppercase tracking-wide text-noorix-muted">
              {t('dashboardStudioFilters')}
            </div>
            <p className="text-[12px] text-noorix-muted mt-1 mb-4 m-0">{t('dashboardStudioFiltersHint')}</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-noorix-text" htmlFor="studio-year">
                  {t('reportYear')}
                </label>
                <Input
                  id="studio-year"
                  type="select"
                  size="sm"
                  value={year}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setYear(Number(e.target.value))}
                >
                  {[now.year, now.year - 1, now.year - 2].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Input>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-noorix-text" htmlFor="studio-month">
                  {t('reportMonth')}
                </label>
                <Input
                  id="studio-month"
                  type="select"
                  size="sm"
                  value={selectedMonth}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(e.target.value)}
                >
                  <option value="">{t('allMonths')}</option>
                  {MONTH_NAMES_EN.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {lang === 'ar' ? MONTH_NAMES_AR[i] : name}
                    </option>
                  ))}
                </Input>
              </div>

              <div className="border-t border-noorix-border pt-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-noorix-muted mb-2">
                  {t('dashboardStudioAdvancedFilters')}
                </div>
                <label className="nx-checkbox flex cursor-pointer items-start gap-2.5 py-1.5 text-[13px] font-medium text-noorix-text select-none">
                  <input
                    type="checkbox"
                    checked={includeCancelledSales}
                    onChange={(e) => setIncludeCancelledSales(e.target.checked)}
                  />
                  <span>{t('dashboardStudioIncludeCancelled')}</span>
                </label>
                <p className="mt-1 text-[11px] text-noorix-muted m-0">{t('dashboardStudioIncludeCancelledHint')}</p>

                <label className="nx-checkbox mt-3 flex cursor-pointer items-start gap-2.5 py-1.5 text-[13px] font-medium text-noorix-text select-none">
                  <input type="checkbox" checked={showCompare} onChange={(e) => setShowCompare(e.target.checked)} />
                  <span>{t('dashboardStudioCompareToggle')}</span>
                </label>
                <p className="mt-1 text-[11px] text-noorix-muted m-0">{t('dashboardStudioCompareToggleHint')}</p>
              </div>
            </div>
          </aside>

          <section className="min-w-0 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-noorix-border bg-noorix-bg-muted/30 px-3 py-2.5">
              <span className="text-[12px] text-noorix-muted">
                {t('dashboardStudioScope')}: <span className="font-semibold text-noorix-text">{filter.label}</span>
                {includeCancelledSales ? (
                  <span className="ms-2 rounded bg-noorix-bg-muted px-1.5 py-0.5 text-[11px] text-noorix-text">
                    {t('dashboardStudioCancelledBadge')}
                  </span>
                ) : null}
              </span>
            </div>

            {!activeCompanyId ? (
              <div className="p-8 text-center text-noorix-muted">{t('pleaseSelectCompany')}</div>
            ) : m.isLoading || m.salesPackLoading ? (
              <DashboardOverviewKpiSkeleton />
            ) : m.error ? (
              <ErrorState className="m-4">
                {m.error instanceof Error ? m.error.message : String(m.error)}
              </ErrorState>
            ) : (
              <>
                <DashboardStudioPeriodSnapshot
                  companyId={activeCompanyId}
                  from={m.supplierFrom}
                  to={m.supplierTo}
                  periodData={m.periodData}
                  isLoading={m.isPeriodLoading}
                  isError={false}
                />

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
                  <DashboardStudioCompareBlock
                    show={showCompare}
                    year={year}
                    selectedMonth={selectedMonthNumber}
                    currentReport={m.report}
                    prevYearReport={prevYearPl.data}
                    prevYearLoading={prevYearPl.isLoading}
                  />
                  <DashboardStudioInsightsPanel
                    payload={m.dashboardInsights.data}
                    isLoading={m.dashboardInsights.isLoading}
                    isError={m.dashboardInsights.isError}
                  />
                </div>

                <div className="text-[12px] font-semibold uppercase tracking-wide text-noorix-muted">
                  {t('dashboardStudioClassicChartsTitle')}
                </div>
                <DashboardOverviewContent m={m} />
              </>
            )}
          </section>
        </div>
      </div>
    </ScreenShell>
  );
}
