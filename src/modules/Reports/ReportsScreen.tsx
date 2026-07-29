/**
 * ReportsScreen — التقرير العام (ربح وخسارة شهري)
 */
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { exportToExcel } from '../../utils/exportUtils';
import { useReportsGeneralProfitLoss } from '../../hooks/useReports';
import { useApiQueries } from '../../hooks/useApiQuery';
import { getGeneralProfitLossReport } from '../../services/api';
import { reportKeys } from '../../services/queryKeys/reports';
import ReportsDetailModal from './ReportsDetailModal';
import { ScreenShell, usePrintPreview } from '../../ui';
import { useIsNarrow700 } from '../../ui';
import {
  EN_MONTHS,
  buildFlatRows,
  buildVisibleRows,
  buildExportRowsFromVisibleRows,
  buildProfitLossExportRowMeta,
  buildCollapsedGroupsForLevel,
  filterVisibleRowsByLabel,
  type PlDisplayLevel,
} from './reportHelpers';
import ProfitLossReportWorkspace from './ProfitLossReportWorkspace';
import { MONTH_NAMES_AR, MONTH_NAMES_EN } from './profitLossPresentationModel';
import { getSaudiNow } from '../../utils/saudiDate';
import type { GeneralProfitLossReport, PlDisplayRow, ReportDetailState, ReportPeriodMode } from './reportTypes';
import {
  rowIdentity,
  type ComparisonColumnPeriod,
} from './reportsComparablePeriodModel';
import {
  buildAccountingPeriodColumns,
  getAccountingPeriodYears,
  type AccountingMonthPeriod,
  type AccountingQuarterPeriod,
} from './accountingReportPeriodModel';
import { buildProfitLossPrintPreviewDocument } from './profitLossPrintPreviewModel';

export default function ReportsScreen() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const currentYear = getSaudiNow().year;
  const [year, setYear] = useState(() => getSaudiNow().year);
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('month');
  const [selectedMonthPeriods, setSelectedMonthPeriods] = useState<AccountingMonthPeriod[]>(() => [{
    year: getSaudiNow().year,
    month: getSaudiNow().month,
  }]);
  const [selectedYears, setSelectedYears] = useState<number[]>(() => [getSaudiNow().year]);
  const [selectedQuarterPeriods, setSelectedQuarterPeriods] = useState<AccountingQuarterPeriod[]>(() => [{
    year: getSaudiNow().year,
    quarter: Math.ceil(getSaudiNow().month / 3),
  }]);
  const [detailState, setDetailState] = useState<ReportDetailState | null>(null);
  const [plDisplayLevel, setPlDisplayLevel] = useState<PlDisplayLevel>(2);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    sales: false,
    purchases: false,
    expenses: false,
  });
  const [rowSearch, setRowSearch] = useState('');
  const company = companies?.find((item) => item.id === activeCompanyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');
  const companyLogoUrl = String(company?.logoUrl || '').trim();
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: lang === 'ar' ? 'معاينة الطباعة' : 'Print preview',
    closeLabel: t('close') || 'إغلاق',
    printLabel: `${t('print')} / PDF`,
  });
  const yearOptions = useMemo(() => Array.from({ length: 6 }, (_, index) => currentYear - index), [currentYear]);

  const { data: report, isLoading, error, isFetching, isPlaceholderData } = useReportsGeneralProfitLoss({
    companyId: activeCompanyId,
    year,
  });
  const availabilityYears = useMemo(() => yearOptions.filter((itemYear) => itemYear !== year), [year, yearOptions]);
  const yearAvailabilityQueries = useApiQueries({
    queries: availabilityYears.map((itemYear) => ({
      queryKey: reportKeys.generalProfitLoss(activeCompanyId, itemYear),
      queryFn: () => getGeneralProfitLossReport(activeCompanyId, itemYear),
      fallbackMessage: 'Failed to load report',
      enabled: !!activeCompanyId && !!itemYear,
    })),
  });
  const previousYear = year - 1;
  const periodSelection = useMemo(() => ({
    mode: periodMode,
    anchorYear: year,
    selectedMonthPeriods,
    selectedQuarterPeriods,
    selectedYears,
  }), [periodMode, selectedMonthPeriods, selectedQuarterPeriods, selectedYears, year]);
  const selectedReportYears = useMemo(() => getAccountingPeriodYears(periodSelection), [periodSelection]);
  const { data: previousYearReport } = useReportsGeneralProfitLoss({
    companyId: activeCompanyId,
    year: previousYear,
    enabled: selectedReportYears.includes(previousYear),
  });
  const extraReportYears = useMemo(
    () => selectedReportYears.filter((itemYear) => itemYear !== year && itemYear !== previousYear),
    [previousYear, selectedReportYears, year],
  );
  const extraReportQueries = useApiQueries({
    queries: extraReportYears.map((itemYear) => ({
      queryKey: reportKeys.generalProfitLoss(activeCompanyId, itemYear),
      queryFn: () => getGeneralProfitLossReport(activeCompanyId, itemYear),
      fallbackMessage: 'Failed to load report',
      enabled: !!activeCompanyId && !!itemYear,
    })),
  });

  const flatRows = useMemo(() => buildFlatRows(report, collapsedGroups), [report, collapsedGroups]);

  useLayoutEffect(() => {
    if (!report) return;
    setCollapsedGroups(buildCollapsedGroupsForLevel(report, plDisplayLevel));
  }, [report, year, activeCompanyId, plDisplayLevel]);

  const visibleRowsBase = useMemo(() => buildVisibleRows(flatRows, collapsedGroups), [flatRows, collapsedGroups]);
  const visibleRows = useMemo(
    () => filterVisibleRowsByLabel(visibleRowsBase, rowSearch, lang),
    [visibleRowsBase, rowSearch, lang],
  );
  const monthNames = useMemo(() => (lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN), [lang]);
  const activePeriodColumns = useMemo<ComparisonColumnPeriod[]>(
    () => buildAccountingPeriodColumns({
      selection: periodSelection,
      monthNames,
      quarterLabel: lang === 'ar' ? 'الربع' : 'Q',
    }),
    [lang, monthNames, periodSelection],
  );
  const currentColumnPeriod = activePeriodColumns[0] ?? null;
  const selectedMonthNumber = periodMode === 'year' ? null : currentColumnPeriod?.period.month ?? null;
  const compareColumnPeriods = useMemo(() => activePeriodColumns.slice(1), [activePeriodColumns]);
  const compareRows = useMemo(() => {
    const rows = new Map<string, PlDisplayRow>();
    const currentRows = buildVisibleRows(buildFlatRows(report, collapsedGroups), collapsedGroups);
    for (const row of currentRows) rows.set(`${year}:${rowIdentity(row)}`, row);
    const previousRows = buildVisibleRows(buildFlatRows(previousYearReport, collapsedGroups), collapsedGroups);
    for (const row of previousRows) rows.set(`${previousYear}:${rowIdentity(row)}`, row);
    extraReportQueries.forEach((query, index) => {
      const itemYear = extraReportYears[index];
      const data = query.data as typeof report | undefined;
      const reportRows = buildVisibleRows(buildFlatRows(data, collapsedGroups), collapsedGroups);
      for (const row of reportRows) rows.set(`${itemYear}:${rowIdentity(row)}`, row);
    });
    return rows;
  }, [collapsedGroups, extraReportQueries, extraReportYears, previousYear, previousYearReport, report, year]);

  const monthLabelForExport = useMemo(() => {
    if (!selectedMonthNumber) return '';
    return monthNames[selectedMonthNumber - 1];
  }, [selectedMonthNumber, monthNames]);

  const yearsWithData = useMemo(() => {
    const available = new Set<number>();
    if (hasProfitLossReportData(report)) available.add(year);
    yearAvailabilityQueries.forEach((query, index) => {
      const itemYear = availabilityYears[index];
      if (hasProfitLossReportData(query.data as GeneralProfitLossReport | undefined)) available.add(itemYear);
    });
    selectedYears.forEach((itemYear) => {
      if (yearOptions.includes(itemYear)) available.add(itemYear);
    });
    if (available.size === 0) available.add(year);
    return yearOptions.filter((itemYear) => available.has(itemYear));
  }, [availabilityYears, report, selectedYears, year, yearAvailabilityQueries, yearOptions]);

  const isMobile = useIsNarrow700();

  function toggleGroup(collapseKey: string) {
    setCollapsedGroups((prev) => ({ ...prev, [collapseKey]: !prev[collapseKey] }));
  }

  function applyPeriodSelection(selection: {
    mode: ReportPeriodMode;
    anchorYear: number;
    selectedMonthPeriods: AccountingMonthPeriod[];
    selectedQuarterPeriods: AccountingQuarterPeriod[];
    selectedYears: number[];
  }) {
    setYear(selection.anchorYear);
    setPeriodMode(selection.mode);
    setSelectedMonthPeriods(selection.selectedMonthPeriods);
    setSelectedQuarterPeriods(selection.selectedQuarterPeriods);
    setSelectedYears(selection.selectedYears);
  }
  const { exportRows, plExportRowMeta } = useMemo(() => {
    if (!report) {
      return { exportRows: [] as Record<string, unknown>[], plExportRowMeta: [] as ReturnType<typeof buildProfitLossExportRowMeta> };
    }
    const rows = buildExportRowsFromVisibleRows(
      visibleRowsBase,
      lang,
      t,
      selectedMonthNumber,
      selectedMonthNumber ? { amountColumnTitle: `${monthLabelForExport} ${year}` } : undefined,
    );
    const metas = buildProfitLossExportRowMeta(report, selectedMonthNumber, visibleRowsBase);
    return { exportRows: rows, plExportRowMeta: metas };
  }, [report, visibleRowsBase, lang, t, monthLabelForExport, year, selectedMonthNumber]);

  /** مفاتيح أعمدة المبالغ الرقمية في Excel (بما فيها أعمدة الفئات الثلاث) */
  const plExcelMoneyColumnKeys = useMemo(() => {
    const keys = [t('revenueGroup'), t('purchasesGroup'), t('expensesGroup')];
    if (selectedMonthNumber && monthLabelForExport) {
      keys.push(`${monthLabelForExport} ${year}`);
      return keys;
    }
    EN_MONTHS.forEach((m) => keys.push(m));
    keys.push(t('reportAnnualTotal'));
    return keys;
  }, [t, selectedMonthNumber, monthLabelForExport, year]);

  function handleExportExcel() {
    if (!report) return;
    void exportToExcel({
      data: exportRows,
      filename: `general-profit-loss-${year}${selectedMonthNumber ? `-m${selectedMonthNumber}` : ''}.xlsx`,
      companyName: companyName || undefined,
      title: selectedMonthNumber
        ? `${t('reportIncomeStatementTitle')} — ${monthLabelForExport} ${year}`
        : `${t('reportGeneral')} — ${year}`,
      sheetName: lang === 'ar' ? 'ربح وخسارة' : 'P&L',
      rtl: lang !== 'en',
      headerColor: selectedMonthNumber ? '1e3a5f' : '185FA5',
      profitLossRowMeta: plExportRowMeta,
      money2ColumnKeys: plExcelMoneyColumnKeys,
      moneyColumnFractionDigits: 0,
    });
  }

  function handlePrintPdf() {
    if (!report) return;
    openPrintDocumentPreview(buildProfitLossPrintPreviewDocument({
      activePeriodColumns,
      companyName: companyName || t('reports'),
      companyLogoUrl,
      compareColumnPeriods,
      compareRows,
      currentColumnPeriod,
      lang,
      reportTitle: t('reportIncomeStatementTitle'),
      reportsFallbackTitle: t('reports'),
      rows: visibleRows,
      t,
      year,
    }));
  }

  return (
    <ScreenShell variant="report">
      {printPreviewModal}
      <ReportsDetailModal state={detailState} onClose={() => setDetailState(null)} companyId={activeCompanyId} year={year} t={t} lang={lang} />

      <ProfitLossReportWorkspace
        activeCompanyId={activeCompanyId}
        companyName={companyName}
        report={report}
        isLoading={isLoading}
        error={error as Error | null}
        isFetching={isFetching}
        isPlaceholderData={isPlaceholderData}
        year={year}
        yearOptions={yearOptions}
        yearsWithData={yearsWithData}
        periodMode={periodMode}
        selectedMonthPeriods={selectedMonthPeriods}
        selectedQuarterPeriods={selectedQuarterPeriods}
        selectedYears={selectedYears}
        selectedMonthNumber={selectedMonthNumber}
        currentColumnPeriod={currentColumnPeriod}
        visibleRows={visibleRows}
        flatRowsCount={flatRows.length}
        collapsedGroups={collapsedGroups}
        plDisplayLevel={plDisplayLevel}
        rowSearch={rowSearch}
        isMobile={isMobile}
        lang={lang}
        t={t}
        compareColumnPeriods={compareColumnPeriods}
        compareRows={compareRows}
        onApplyPeriodSelection={applyPeriodSelection}
        onDisplayLevelChange={setPlDisplayLevel}
        onRowSearchChange={setRowSearch}
        onToggleGroup={toggleGroup}
        onOpenDetail={(payload) => setDetailState(payload)}
        onExportExcel={handleExportExcel}
        onPrintPdf={handlePrintPdf}
      />
    </ScreenShell>
  );
}

function hasProfitLossReportData(report: GeneralProfitLossReport | null | undefined) {
  return buildFlatRows(report).some((row) => {
    if (numericAmount(row.total) !== 0) return true;
    return (row.months || []).some((value) => numericAmount(value) !== 0);
  });
}

function numericAmount(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
