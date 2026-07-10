/**
 * ReportsScreen — التقرير العام (ربح وخسارة شهري)
 */
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { exportToExcel } from '../../utils/exportUtils';
import { buildPrintHtmlTable } from '../../utils/printTableHtml';
import { useReportsGeneralProfitLoss } from '../../hooks/useReports';
import ReportsDetailModal from './ReportsDetailModal';
import { ScreenShell, usePrintPreview } from '../../ui';
import { useIsNarrow700 } from '../../ui';
import { useDateFilter } from '../../ui/date';
import {
  EN_MONTHS,
  amountText,
  percentText,
  displayLabel,
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
import { buildPlMonthStatementBody, plMonthStatementPrintCss } from './reportsPlMonthPrint';
import { getSaudiNow } from '../../utils/saudiDate';
import type { PlDisplayRow, ReportDetailState, ReportPeriodMode } from './reportTypes';
import {
  applyCustomCompareMonths,
  buildCompareColumnPeriods,
  buildRowMap,
  deriveComparablePeriod,
} from './reportsComparablePeriodModel';

export default function ReportsScreen() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const currentYear = getSaudiNow().year;
  const [year, setYear] = useState(() => getSaudiNow().year);
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('year');
  const [selectedMonth, setSelectedMonth] = useState(() => String(getSaudiNow().month));
  const [detailState, setDetailState] = useState<ReportDetailState | null>(null);
  const [plDisplayLevel, setPlDisplayLevel] = useState<PlDisplayLevel>(2);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    sales: false,
    purchases: false,
    expenses: false,
  });
  const [rowSearch, setRowSearch] = useState('');
  const compareFilter = useDateFilter('all');
  const [compareSelectedMonths, setCompareSelectedMonths] = useState<number[]>([]);
  const company = companies?.find((item) => item.id === activeCompanyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');
  const companyLogoUrl = String(company?.logoUrl || '').trim();
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: lang === 'ar' ? 'معاينة الطباعة' : 'Print preview',
    closeLabel: t('close') || 'إغلاق',
    printLabel: `${t('print')} / PDF`,
  });

  const { data: report, isLoading, error, isFetching, isPlaceholderData } = useReportsGeneralProfitLoss({
    companyId: activeCompanyId,
    year,
  });

  const comparePeriodBase = useMemo(() => deriveComparablePeriod(compareFilter.state), [compareFilter.state]);
  const comparePeriod = useMemo(
    () => applyCustomCompareMonths(comparePeriodBase, compareSelectedMonths),
    [comparePeriodBase, compareSelectedMonths],
  );
  const compareEnabled = comparePeriod.mode !== 'all';
  const { data: loadedCompareReport, isFetching: isFetchingCompare } = useReportsGeneralProfitLoss({
    companyId: activeCompanyId,
    year: comparePeriod.year,
    enabled: compareEnabled && comparePeriod.year !== year,
  });
  const compareReport = !compareEnabled ? undefined : comparePeriod.year === year ? report : loadedCompareReport;

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
  const selectedMonthNumber = periodMode === 'month' ? Number(selectedMonth) : null;
  const monthNames = useMemo(() => (lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN), [lang]);
  const compareColumnPeriods = useMemo(
    () => buildCompareColumnPeriods(comparePeriod, monthNames, compareFilter.label),
    [compareFilter.label, comparePeriod, monthNames],
  );
  const compareFlatRows = useMemo(() => buildFlatRows(compareReport, collapsedGroups), [collapsedGroups, compareReport]);
  const compareVisibleRows = useMemo(
    () => buildVisibleRows(compareFlatRows, collapsedGroups),
    [collapsedGroups, compareFlatRows],
  );
  const compareRows = useMemo(() => buildRowMap(compareVisibleRows), [compareVisibleRows]);
  const compareMonthSet = useMemo(
    () => [...new Set(compareSelectedMonths)].filter((month) => month >= 1 && month <= 12).sort((a, b) => a - b),
    [compareSelectedMonths],
  );
  const showCompareMonthPicker = compareEnabled && (comparePeriodBase.mode === 'month' || comparePeriodBase.mode === 'months');

  const monthLabelForExport = useMemo(() => {
    if (!selectedMonthNumber) return '';
    return monthNames[selectedMonthNumber - 1];
  }, [selectedMonthNumber, monthNames]);

  const yearOptions = useMemo(() => Array.from({ length: 6 }, (_, index) => currentYear - index), [currentYear]);

  const isMobile = useIsNarrow700();

  function toggleGroup(collapseKey: string) {
    setCollapsedGroups((prev) => ({ ...prev, [collapseKey]: !prev[collapseKey] }));
  }

  function toggleCompareMonth(month: number) {
    setCompareSelectedMonths((prev) => (
      prev.includes(month)
        ? prev.filter((item) => item !== month)
        : [...prev, month].sort((a, b) => a - b)
    ));
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
    const printFlat = buildFlatRows(report, collapsedGroups);
    const printRowsForDoc = buildVisibleRows(printFlat, collapsedGroups);
    const monthNames = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
    const monthLabel = selectedMonthNumber ? monthNames[selectedMonthNumber - 1] : '';
    const printLang = lang === 'en' ? 'en' : 'ar';
    const printDir = lang === 'en' ? 'ltr' : 'rtl';

    if (selectedMonthNumber) {
      const amountColumnTitle = `${monthLabel} ${year}`;
      openPrintDocumentPreview({
        title: t('reportIncomeStatementTitle'),
        companyName: companyName || t('reports'),
        logoUrl: companyLogoUrl,
        subtitle: `${monthLabel} ${year}`,
        landscape: false,
        htmlLang: printLang,
        htmlDir: printDir,
        showPageCounter: false,
        pageMarginMm: 5,
        extraCss: plMonthStatementPrintCss(),
        body: buildPlMonthStatementBody({
          report,
          selectedMonthNumber,
          monthLabel,
          year,
          lang,
          t,
          amountColumnTitle,
          collapsedGroups,
        }),
      });
      return;
    }

    openPrintDocumentPreview({
      title: t('reportGeneral'),
      companyName: companyName || t('reports'),
      logoUrl: companyLogoUrl,
      subtitle: `${year} · ${t('reportGeneral')}`,
      landscape: true,
      htmlLang: printLang,
      htmlDir: printDir,
      body: buildPrintHtmlTable({
        wrapperClassName: null,
        headerRows: [{
          cells: [
            { value: t('reportItem') },
            ...EN_MONTHS.map((month) => ({ value: month, align: 'end' as const })),
            { value: t('reportAnnualTotal'), align: 'end' },
            { value: t('reportSalesShareYear'), align: 'end' },
          ],
        }],
        bodyRows: printRowsForDoc.map((row: PlDisplayRow) => ({
          cells: [
            { value: displayLabel(row, lang) },
            ...(row.months ?? []).map((value) => ({ value: amountText(value), align: 'end' as const })),
            { value: amountText(row.total), align: 'end' },
            { value: percentText(row.percentOfSalesYear), align: 'end' },
          ],
        })),
      }),
    });
  }

  return (
    <ScreenShell>
      {printPreviewModal}
      <ReportsDetailModal state={detailState} onClose={() => setDetailState(null)} companyId={activeCompanyId} year={year} t={t} lang={lang} />

      <ProfitLossReportWorkspace
        activeCompanyId={activeCompanyId}
        companyName={companyName}
        report={report}
        isLoading={isLoading}
        error={error as Error | null}
        isFetching={isFetching}
        isPlaceholderData={isPlaceholderData || (compareEnabled && isFetchingCompare)}
        year={year}
        yearOptions={yearOptions}
        periodMode={periodMode}
        selectedMonth={selectedMonth}
        selectedMonthNumber={selectedMonthNumber}
        visibleRows={visibleRows}
        flatRowsCount={flatRows.length}
        collapsedGroups={collapsedGroups}
        plDisplayLevel={plDisplayLevel}
        rowSearch={rowSearch}
        isMobile={isMobile}
        lang={lang}
        t={t}
        compareFilter={compareFilter}
        compareEnabled={compareEnabled}
        compareColumnPeriods={compareColumnPeriods}
        compareRows={compareRows}
        compareMonthSet={compareMonthSet}
        showCompareMonthPicker={showCompareMonthPicker}
        onYearChange={setYear}
        onPeriodModeChange={setPeriodMode}
        onSelectedMonthChange={setSelectedMonth}
        onToggleCompareMonth={toggleCompareMonth}
        onClearCompareMonths={() => setCompareSelectedMonths([])}
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
