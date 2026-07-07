/**
 * ReportsScreen — التقرير العام (ربح وخسارة شهري)
 */
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { exportTableToPdf, exportToExcel } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import { useReportsGeneralProfitLoss } from '../../hooks/useReports';
import ReportsDetailModal from './ReportsDetailModal';
import { ScreenShell } from '../../ui';
import { useIsNarrow700 } from '../../ui';
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
import { profitLossPdfExportExtraCss } from './reportsPlExportPdfCss';
import { getSaudiNow } from '../../utils/saudiDate';
import type { PlDisplayRow, ReportDetailState, ReportPeriodMode } from './reportTypes';

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
  const company = companies?.find((item) => item.id === activeCompanyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');

  const { data: report, isLoading, error, isFetching, isPlaceholderData } = useReportsGeneralProfitLoss({
    companyId: activeCompanyId,
    year,
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
  const selectedMonthNumber = periodMode === 'month' ? Number(selectedMonth) : null;

  const monthLabelForExport = useMemo(() => {
    if (!selectedMonthNumber) return '';
    const names = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
    return names[selectedMonthNumber - 1];
  }, [selectedMonthNumber, lang]);

  const yearOptions = useMemo(() => Array.from({ length: 6 }, (_, index) => currentYear - index), [currentYear]);

  const isMobile = useIsNarrow700();

  function toggleGroup(collapseKey: string) {
    setCollapsedGroups((prev) => ({ ...prev, [collapseKey]: !prev[collapseKey] }));
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

  function handleExportPdf() {
    if (!report) return;
    exportTableToPdf({
      companyName: companyName || t('reports'),
      title: selectedMonthNumber
        ? `${t('reportIncomeStatementTitle')} — ${year}`
        : `${t('reportGeneral')} — ${year}`,
      subtitle: selectedMonthNumber
        ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]}`
        : '',
      filename: `general-profit-loss-${year}${selectedMonthNumber ? `-m${selectedMonthNumber}` : ''}.pdf`,
      landscape: !selectedMonthNumber,
      data: exportRows,
      extraCss: profitLossPdfExportExtraCss(),
      htmlDir: lang === 'en' ? 'ltr' : 'rtl',
      htmlLang: lang === 'en' ? 'en' : 'ar',
      showPageCounter: !selectedMonthNumber,
      pageMarginMm: selectedMonthNumber ? 8 : 10,
      pdfRowMetas: plExportRowMeta,
    });
  }

  function escPrintCell(s: string) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function handlePrint() {
    if (!report) return;
    const printFlat = buildFlatRows(report, collapsedGroups);
    const printRowsForDoc = buildVisibleRows(printFlat, collapsedGroups);
    const monthNames = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
    const monthLabel = selectedMonthNumber ? monthNames[selectedMonthNumber - 1] : '';
    const printLang = lang === 'en' ? 'en' : 'ar';
    const printDir = lang === 'en' ? 'ltr' : 'rtl';

    if (selectedMonthNumber) {
      const amountColumnTitle = `${monthLabel} ${year}`;
      openPrintWindow({
        title: t('reportIncomeStatementTitle'),
        companyName: companyName || t('reports'),
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

    const head = `${EN_MONTHS.map((month) => `<th>${escPrintCell(month)}</th>`).join('')}<th>${escPrintCell(t('reportAnnualTotal'))}</th><th>${escPrintCell(t('reportSalesShareYear'))}</th>`;
    const bodyRows = printRowsForDoc
      .map((row: PlDisplayRow) => {
        const firstCell = escPrintCell(displayLabel(row, lang));
        const monthsCells = (row.months ?? []).map((value) => `<td>${amountText(value)}</td>`).join('');
        return `<tr><td>${firstCell}</td>${monthsCells}<td>${amountText(row.total)}</td><td>${percentText(row.percentOfSalesYear)}</td></tr>`;
      })
      .join('');

    openPrintWindow({
      title: t('reportGeneral'),
      companyName: companyName || t('reports'),
      subtitle: `${year} · ${t('reportGeneral')}`,
      landscape: true,
      htmlLang: printLang,
      htmlDir: printDir,
      body: `<table><thead><tr><th>${escPrintCell(t('reportItem'))}</th>${head}</tr></thead><tbody>${bodyRows}</tbody></table>`,
    });
  }

  return (
    <ScreenShell>
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
        onYearChange={setYear}
        onPeriodModeChange={setPeriodMode}
        onSelectedMonthChange={setSelectedMonth}
        onDisplayLevelChange={setPlDisplayLevel}
        onRowSearchChange={setRowSearch}
        onToggleGroup={toggleGroup}
        onOpenDetail={(payload) => setDetailState(payload)}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        onPrint={handlePrint}
      />
    </ScreenShell>
  );
}
