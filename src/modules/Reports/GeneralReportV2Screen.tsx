import React, { useLayoutEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useReportsGeneralProfitLoss } from '../../hooks/useReports';
import { exportToExcel } from '../../utils/exportUtils';
import ReportsDetailModal from './ReportsDetailModal';
import { Badge, Button, FilterToolbar, Input, MetricCard, PrintPreviewModal, SimpleTable } from '../../ui';
import { DateFilterBar, useDateFilter } from '../../ui/date';
import {
  percentText,
  buildFlatRows,
  buildVisibleRows,
  buildCollapsedGroupsForLevel,
  filterVisibleRowsByLabel,
  type PlDisplayLevel,
} from './reportHelpers';
import { MONTH_NAMES_AR, MONTH_NAMES_EN } from './profitLossPresentationModel';
import type { PlDisplayRow, ReportDetailState } from './reportTypes';
import {
  buildStatementRowsForV2 as buildStatementRowsForV2Model,
  buildV2ExportRows as buildV2ExportRowsModel,
} from './generalReportV2Model';
import {
  applyCustomCompareMonths,
  buildCompareColumnPeriods,
  buildRowMap,
  cardAmount,
  deriveComparablePeriod,
  type ComparablePeriod,
} from './reportsComparablePeriodModel';
import { buildGeneralReportV2PrintHtml } from './generalReportV2PrintModel';
import {
  buildGeneralReportV2TableModel,
  formatGeneralReportV2Change,
  generalReportV2TableRowClass,
} from './generalReportV2Columns';

export default function GeneralReportV2Screen() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const dateFilter = useDateFilter();
  const compareFilter = useDateFilter('all');
  const [compareSelectedMonths, setCompareSelectedMonths] = useState<number[]>([]);
  const currentPeriod = useMemo(() => deriveComparablePeriod(dateFilter.state), [dateFilter.state]);
  const comparePeriodBase = useMemo(() => deriveComparablePeriod(compareFilter.state), [compareFilter.state]);
  const canCustomizeCompareMonths = comparePeriodBase.mode === 'month' || comparePeriodBase.mode === 'months';
  const compareMonthSet = useMemo(
    () => [...new Set(compareSelectedMonths)].filter((month) => month >= 1 && month <= 12).sort((a, b) => a - b),
    [compareSelectedMonths],
  );
  const comparePeriod = useMemo<ComparablePeriod>(() => {
    return applyCustomCompareMonths(comparePeriodBase, compareMonthSet);
  }, [compareMonthSet, comparePeriodBase]);
  const compareEnabled = comparePeriod.mode !== 'all';
  const showCompareMonthPicker = compareEnabled && canCustomizeCompareMonths;
  const year = currentPeriod.year;
  const [detailState, setDetailState] = useState<ReportDetailState | null>(null);
  const [printPreviewHtml, setPrintPreviewHtml] = useState('');
  const [displayLevel, setDisplayLevel] = useState<PlDisplayLevel>(2);
  const [rowSearch, setRowSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    sales: false,
    purchases: false,
    expenses: false,
  });
  const company = companies?.find((item) => item.id === activeCompanyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');
  const companyLogoUrl = String(company?.logoUrl || '').trim();
  const selectedMonthNumber = currentPeriod.mode === 'month' ? currentPeriod.month : null;
  const monthNames = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
  const monthLabel = selectedMonthNumber ? monthNames[selectedMonthNumber - 1] : dateFilter.label;
  const comparePeriodLabel = comparePeriod.months?.length
    ? comparePeriod.months.map((month) => monthNames[month - 1]).join(' + ')
    : compareFilter.label;
  const compareColumnPeriods = useMemo(
    () => compareEnabled ? buildCompareColumnPeriods(comparePeriod, monthNames, comparePeriodLabel) : [],
    [compareEnabled, comparePeriod, comparePeriodLabel, monthNames],
  );

  const { data: report, isLoading, error, isFetching, isPlaceholderData } = useReportsGeneralProfitLoss({
    companyId: activeCompanyId,
    year,
  });
  const { data: loadedCompareReport, isFetching: isFetchingCompare } = useReportsGeneralProfitLoss({
    companyId: activeCompanyId,
    year: comparePeriod.year,
    enabled: compareEnabled && comparePeriod.year !== year,
  });
  const compareReport = !compareEnabled ? null : comparePeriod.year === year ? report : loadedCompareReport;

  useLayoutEffect(() => {
    if (!report) return;
    setCollapsedGroups(buildCollapsedGroupsForLevel(report, displayLevel));
  }, [report, year, activeCompanyId, displayLevel]);

  const flatRows = useMemo(() => buildFlatRows(report, collapsedGroups), [report, collapsedGroups]);
  const visibleRowsBase = useMemo(() => buildVisibleRows(flatRows, collapsedGroups), [flatRows, collapsedGroups]);
  const statementRowsBase = useMemo(() => buildStatementRowsForV2Model(visibleRowsBase), [visibleRowsBase]);
  const visibleRows = useMemo(() => filterVisibleRowsByLabel(statementRowsBase, rowSearch, lang), [statementRowsBase, rowSearch, lang]);

  const compareFlatRows = useMemo(() => buildFlatRows(compareReport, collapsedGroups), [collapsedGroups, compareReport]);
  const compareRows = useMemo(() => {
    return buildRowMap(buildStatementRowsForV2Model(buildVisibleRows(compareFlatRows, collapsedGroups)));
  }, [collapsedGroups, compareFlatRows]);

  const currentSales = cardAmount(report, 'sales', currentPeriod);
  const currentGrossProfit = cardAmount(report, 'grossProfit', currentPeriod);
  const currentNetProfit = cardAmount(report, 'netProfit', currentPeriod);
  const compareNetProfit = compareEnabled ? cardAmount(compareReport, 'netProfit', comparePeriod) : 0;
  const currentMargin = currentSales ? (currentNetProfit / currentSales) * 100 : 0;

  const exportRows = useMemo(() => buildV2ExportRowsModel(visibleRows, {
    lang,
    t,
    selectedMonthNumber,
    monthLabel,
    year,
    monthLabels: report?.months?.map((month) => month.label) || monthNames,
  }), [lang, monthLabel, monthNames, report?.months, selectedMonthNumber, t, visibleRows, year]);

  function toggleCompareMonth(month: number) {
    setCompareSelectedMonths((prev) => (
      prev.includes(month)
        ? prev.filter((item) => item !== month)
        : [...prev, month].sort((a, b) => a - b)
    ));
  }

  const formatChange = (current: number, previous: number) => formatGeneralReportV2Change(current, previous, lang);
  const isYearTable = currentPeriod.mode === 'year';
  const { activeColumns, tableMinWidth } = useMemo(() => buildGeneralReportV2TableModel({
    lang,
    year,
    monthNames,
    currentPeriod,
    comparePeriod,
    compareEnabled,
    compareColumnPeriods,
    compareRows,
    collapsedGroups,
    selectedMonthNumber,
    currentPeriodLabel: dateFilter.label,
    annualTotalLabel: t('reportAnnualTotal'),
    toggleGroup,
    openDetail,
  }), [
    collapsedGroups,
    compareColumnPeriods,
    compareEnabled,
    comparePeriod,
    compareRows,
    currentPeriod,
    dateFilter.label,
    lang,
    monthNames,
    selectedMonthNumber,
    t,
    year,
  ]);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openDetail(row: PlDisplayRow, month: number | null, showTrend: boolean) {
    if (!row.groupKey) return;
    setDetailState({
      month,
      groupKey: row.groupKey,
      itemKey: row.itemKey,
      showTrend,
    });
  }

  function handleExportExcel() {
    if (!report) return;
    void exportToExcel({
      data: exportRows,
      filename: `general-profit-loss-v2-${year}${selectedMonthNumber ? `-m${selectedMonthNumber}` : ''}.xlsx`,
      companyName: companyName || undefined,
      title: selectedMonthNumber ? `${t('reportIncomeStatementTitle')} - ${monthLabel} ${year}` : `${t('reportGeneralV2')} - ${year}`,
      sheetName: lang === 'ar' ? 'قائمة الدخل' : 'Income statement',
      rtl: lang !== 'en',
      headerColor: '111827',
      money2ColumnKeys: selectedMonthNumber ? [`${monthLabel} ${year}`] : [...(report?.months?.map((month) => month.label) || monthNames), t('reportAnnualTotal')],
      moneyColumnFractionDigits: 0,
    });
  }

  function buildFilteredPrintHtml() {
    return buildGeneralReportV2PrintHtml({
      report,
      visibleRows,
      compareRows,
      compareColumnPeriods,
      currentPeriod,
      compareEnabled,
      periodTitle: dateFilter.label,
      compareTitle: comparePeriodLabel,
      year,
      lang,
      t,
      companyName,
      companyLogoUrl,
      currentNetProfit,
      currentGrossProfit,
      currentMargin,
      formatChange,
    });
  }

  function openPrintablePreview() {
    if (!report) return;
    setPrintPreviewHtml(buildFilteredPrintHtml());
  }

  function handlePrintPdf() {
    openPrintablePreview();
  }

  return (
    <div className="flex flex-col gap-4">
      <ReportsDetailModal state={detailState} onClose={() => setDetailState(null)} companyId={activeCompanyId} year={year} t={t} lang={lang} />

      <PrintPreviewModal
        open={!!printPreviewHtml}
        onClose={() => setPrintPreviewHtml('')}
        title={lang === 'ar' ? 'معاينة الطباعة' : 'Print preview'}
        html={printPreviewHtml}
        closeLabel={lang === 'ar' ? 'إغلاق' : 'Close'}
        printLabel={lang === 'ar' ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}
        iframeTitle={lang === 'ar' ? 'معاينة طباعة التقرير' : 'Report print preview'}
      />

      <section className="rounded-lg border border-noorix-border bg-white shadow-sm">
        <FilterToolbar
          className="border-b border-noorix-border bg-slate-50 px-4 py-3"
          filtersClassName="justify-center"
          actionsClassName="justify-center sm:justify-end"
          actions={(
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" type="button" onClick={handleExportExcel} disabled={!report}>{t('exportExcel')}</Button>
              <Button size="sm" type="button" onClick={handlePrintPdf} disabled={!report}>{t('print')} / PDF</Button>
            </div>
          )}
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-black text-slate-500">{lang === 'ar' ? 'الفترة' : 'Period'}</span>
              <DateFilterBar filter={dateFilter} modes={['month', 'months', 'quarter', 'year']} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-black text-slate-500">{lang === 'ar' ? 'المقارنة' : 'Compare with'}</span>
              <DateFilterBar filter={compareFilter} modes={['all', 'range', 'quarter', 'year']} />
            </div>
          </div>
        </FilterToolbar>

        {showCompareMonthPicker && (
          <div className="border-b border-noorix-border bg-white px-4 py-3">
            <div className="mx-auto flex max-w-[980px] flex-wrap items-center justify-center gap-2">
              <span className="text-[12px] font-black text-slate-500">{lang === 'ar' ? 'أشهر المقارنة' : 'Compare months'}</span>
              {monthNames.map((name, index) => {
                const month = index + 1;
                const selected = compareMonthSet.includes(month);
                return (
                  <Button
                    key={month}
                    size="sm"
                    variant={selected ? 'primary' : 'default'}
                    type="button"
                    onClick={() => toggleCompareMonth(month)}
                  >
                    {name}
                  </Button>
                );
              })}
              {compareMonthSet.length > 0 && (
                <Button size="sm" type="button" onClick={() => setCompareSelectedMonths([])}>
                  {lang === 'ar' ? 'إلغاء التخصيص' : 'Clear custom'}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4 p-4">
          <div className="mx-auto min-w-0 max-w-[760px] text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge color="blue" size="sm">{t('reportIncomeStatementTitle')}</Badge>
              <Badge color="gray" size="sm">{companyName || t('reports')}</Badge>
            </div>
            <h2 className="m-0 mt-3 text-[22px] font-black text-noorix-text">{t('reportGeneralV2')}</h2>
            <div className="mt-3 text-[12px] font-bold text-noorix-muted">
              {dateFilter.label}{compareEnabled ? ` | ${lang === 'ar' ? 'مقارنة' : 'Compare'}: ${comparePeriodLabel}` : ''}
            </div>
          </div>

          <div className="mx-auto grid w-full max-w-[980px] min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard color="var(--color-nx-net-profit)" className="min-h-[138px]">
              <MetricCard.Header label={t('annualNetProfit')} subLabel={dateFilter.label} />
              <MetricCard.Value value={currentNetProfit} currency="SR" color="var(--color-nx-net-profit)" />
              <MetricCard.Footer className="mt-auto border-t border-noorix-border px-4 py-2 text-[11px] font-bold text-noorix-muted">
                {compareEnabled ? `${lang === 'ar' ? 'التغير' : 'Change'} ${formatChange(currentNetProfit, compareNetProfit)}` : (lang === 'ar' ? 'بدون مقارنة' : 'No comparison')}
              </MetricCard.Footer>
            </MetricCard>

            <MetricCard color="var(--color-nx-profit)" className="min-h-[138px]">
              <MetricCard.Header label={t('annualGrossProfit')} subLabel={dateFilter.label} />
              <MetricCard.Value value={currentGrossProfit} currency="SR" color="var(--color-nx-profit)" />
              <MetricCard.Footer className="mt-auto border-t border-noorix-border px-4 py-2 text-[11px] font-bold text-noorix-muted">
                {lang === 'ar' ? 'إجمالي الفترة المحددة' : 'Selected period total'}
              </MetricCard.Footer>
            </MetricCard>

            <MetricCard color="var(--color-nx-sales)" className="min-h-[138px]">
              <MetricCard.Header label={lang === 'ar' ? 'هامش الربح' : 'Profit margin'} subLabel={dateFilter.label} />
              <MetricCard.Value value={percentText(currentMargin)} color="var(--color-nx-sales)" />
              <MetricCard.Footer className="mt-auto border-t border-noorix-border px-4 py-2 text-[11px] font-bold text-noorix-muted">
                {lang === 'ar' ? 'صافي الربح إلى الإيرادات' : 'Net profit to revenue'}
              </MetricCard.Footer>
            </MetricCard>

            <MetricCard color={compareEnabled ? 'var(--color-nx-profit)' : 'var(--noorix-border)'} className="min-h-[138px]">
              <MetricCard.Header label={lang === 'ar' ? 'المقارنة' : 'Comparison'} subLabel={compareEnabled ? comparePeriodLabel : (lang === 'ar' ? 'معطلة' : 'Off')} />
              <MetricCard.Value
                value={compareEnabled ? formatChange(currentNetProfit, compareNetProfit) : (lang === 'ar' ? 'بدون' : 'Off')}
                color={compareEnabled ? 'var(--color-nx-profit)' : 'var(--noorix-muted)'}
              />
              <MetricCard.Footer className="mt-auto border-t border-noorix-border px-4 py-2 text-[11px] font-bold text-noorix-muted">
                {compareEnabled ? `${lang === 'ar' ? 'مقارنة مع' : 'Compared with'} ${comparePeriodLabel}` : (lang === 'ar' ? 'لا تظهر أعمدة المقارنة' : 'Comparison columns hidden')}
              </MetricCard.Footer>
            </MetricCard>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-noorix-border px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((level) => (
              <Button
                key={level}
                size="sm"
                variant={displayLevel === level ? 'primary' : 'default'}
                type="button"
                onClick={() => setDisplayLevel(level as PlDisplayLevel)}
              >
                {level === 1 ? t('reportPlLevel1') : level === 2 ? t('reportPlLevel2') : t('reportPlLevel3')}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-8 w-[210px]"
              value={rowSearch}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRowSearch(event.target.value)}
              placeholder={t('reportPlRowFilterPlaceholder')}
            />
          </div>
        </div>
      </section>

      {!activeCompanyId && <div className="rounded-lg border border-noorix-border bg-white p-5 text-center text-noorix-muted">{t('pleaseSelectCompany')}</div>}
      {(isLoading || (compareEnabled && isFetchingCompare)) && <div className="rounded-lg border border-noorix-border bg-white p-5 text-center text-noorix-muted">{t('loading')}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-center font-bold text-red-700">{error.message}</div>}

      {activeCompanyId && report && (
        <section className={`flex justify-center ${isFetching && isPlaceholderData ? 'opacity-70' : ''}`}>
          <SimpleTable
            columns={activeColumns}
            data={visibleRows}
            tableMinWidth={tableMinWidth}
            frameClassName={isYearTable ? 'noorix-report-table--year' : 'noorix-report-table--fit'}
            tableClassName={isYearTable ? 'noorix-report-table__table--year' : 'noorix-report-table__table'}
            compact
            cellPadding="8px 14px"
            getRowClassName={(row) => generalReportV2TableRowClass(row)}
            emptyMessage={lang === 'ar' ? 'لا توجد بيانات' : 'No data'}
          />
        </section>
      )}
    </div>
  );
}
