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
import { Button, Input, ScreenTabs, ScreenShell, cn, MetricCard } from '../../ui';
import { useIsNarrow700 } from '../../hooks/useMediaQuery';
import { KPI_CARD_SPARKLINE_COLORS } from '../../constants/kpiCardTheme';
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
import GeneralPlTable from './GeneralPlTable';
import { buildPlMonthStatementBody, plMonthStatementPrintCss } from './reportsPlMonthPrint';
import { profitLossPdfExportExtraCss } from './reportsPlExportPdfCss';
import { getSaudiNow } from '../../utils/saudiDate';

const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function ReportsScreen() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const currentYear = getSaudiNow().year;
  const [year, setYear] = useState(() => getSaudiNow().year);
  const [selectedMonth, setSelectedMonth] = useState(() => String(getSaudiNow().month));
  const [detailState, setDetailState] = useState<any>(null);
  const [plDisplayLevel, setPlDisplayLevel] = useState<PlDisplayLevel>(2);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    sales: false,
    purchases: false,
    expenses: false,
  });
  const [rowSearch, setRowSearch] = useState('');
  const company = companies?.find((item: any) => item.id === activeCompanyId);
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
  const monthLabelForExport = useMemo(() => {
    if (!selectedMonth) return '';
    const names = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
    return names[Number(selectedMonth) - 1];
  }, [selectedMonth, lang]);

  const yearOptions = useMemo(() => Array.from({ length: 6 }, (_: any, index: any) => currentYear - index), [currentYear]);
  const selectedMonthNumber = selectedMonth ? Number(selectedMonth) : null;

  const mobileMonthTabItems = useMemo(() => {
    const names = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
    return [
      { id: '', label: t('allMonths') },
      ...names.map((name: any, i: any) => ({ id: String(i + 1), label: name })),
    ];
  }, [t, lang]);

  const isMobile = useIsNarrow700();

  function toggleGroup(collapseKey: any) {
    setCollapsedGroups((prev: any) => ({ ...prev, [collapseKey]: !prev[collapseKey] }));
  }

  function getCardValue(key: any) {
    if (!report) return '0';
    if (!selectedMonthNumber) return report.cards[key] || '0';
    if (key === 'grossProfit' || key === 'netProfit') {
      return report.summaryRows.find((row: any) => row.key === key)?.months[selectedMonthNumber - 1] || '0';
    }
    return report.groups.find((row: any) => row.key === key)?.months[selectedMonthNumber - 1] || '0';
  }

  function getCardProfitPercent(key: any) {
    if (!report || (key !== 'grossProfit' && key !== 'netProfit')) return null;
    const sales = Number(getCardValue('sales') || 0);
    if (!sales || sales < 0.0000001) return null;
    const profit = Number(getCardValue(key) || 0);
    return ((profit / sales) * 100).toFixed(1);
  }

  const { exportRows, plExportRowMeta } = useMemo(() => {
    if (!report) {
      return { exportRows: [] as Record<string, unknown>[], plExportRowMeta: [] as ReturnType<typeof buildProfitLossExportRowMeta> };
    }
    const rows = buildExportRowsFromVisibleRows(
      visibleRowsBase,
      lang,
      t,
      selectedMonth ? Number(selectedMonth) : null,
      selectedMonth ? { amountColumnTitle: `${monthLabelForExport} ${year}` } : undefined,
    );
    const metas = buildProfitLossExportRowMeta(report, selectedMonthNumber, visibleRowsBase);
    return { exportRows: rows, plExportRowMeta: metas };
  }, [report, visibleRowsBase, lang, t, selectedMonth, monthLabelForExport, year, selectedMonthNumber]);

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

    const head = `${EN_MONTHS.map((month: any) => `<th>${escPrintCell(month)}</th>`).join('')}<th>${escPrintCell(t('reportAnnualTotal'))}</th><th>${escPrintCell(t('reportSalesShareYear'))}</th>`;
    const bodyRows = printRowsForDoc
      .map((row: any) => {
        const firstCell = escPrintCell(displayLabel(row, lang));
        const monthsCells = (row.months ?? []).map((value: any) => `<td>${amountText(value)}</td>`).join('');
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

      <div className="flex flex-col gap-4">
      <div className="nx-page-header">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold m-0 text-[18px]">{t('reportGeneral')}</h2>
        </div>
        <div className="flex items-end flex-wrap gap-2 flex-[0_1_auto]">
          <Input type="select" label={t('reportYear')} value={year} onChange={(e: any) => setYear(Number(e.target.value))}>
            {yearOptions.map((option: any) => <option key={option} value={option}>{option}</option>)}
          </Input>
          {!isMobile && (
            <Input type="select" label={t('reportMonth')} value={selectedMonth} onChange={(e: any) => setSelectedMonth(e.target.value)}>
              <option value="">{t('allMonths')}</option>
              {EN_MONTHS.map((month: any, index: any) => <option key={month} value={index + 1}>{month}</option>)}
            </Input>
          )}
          <div className="nx-toolbar">
            <Button size="sm" onClick={handleExportExcel} disabled={!report}>{t('exportExcel')}</Button>
            <Button size="sm" onClick={handleExportPdf} disabled={!report}>طباعة / PDF</Button>
            <Button size="sm" onClick={handlePrint} disabled={!report}>{t('print')}</Button>
          </div>
        </div>
      </div>

      {!activeCompanyId && (
        <div className="noorix-surface-card p-5 text-center text-noorix-muted">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {activeCompanyId && (
        <>
          <div className="noorix-surface-card p-4 text-noorix-muted text-[13px]">
            {t('reportClickHint')}
            <div className="mt-2">{t('reportPlDetailInvoicesHint')}</div>
            {selectedMonthNumber && <div className="mt-2">{t('reportFocusedMonthDesc')}</div>}
          </div>

          {report && (
            <div
              className={cn(
                'nx-kpi-container mt-1 transition-opacity duration-200',
                isFetching && isPlaceholderData && 'pointer-events-none opacity-55',
              )}
            >
              <div className="nx-kpi-grid">
                {[
                  { key: 'sales', label: selectedMonthNumber ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]} — ${t('revenueGroup')}` : t('annualSales') },
                  { key: 'purchases', label: selectedMonthNumber ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]} — ${t('purchasesGroup')}` : t('annualPurchases') },
                  { key: 'expenses', label: selectedMonthNumber ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]} — ${t('expensesGroup')}` : t('annualExpenses') },
                  { key: 'grossProfit', label: t('annualGrossProfit') },
                  { key: 'netProfit', label: t('annualNetProfit') },
                ].map((card: any) => {
                  const profitPct = (card.key === 'grossProfit' || card.key === 'netProfit') ? getCardProfitPercent(card.key) : null;
                  const val = Number(getCardValue(card.key) || 0);
                  const isProfitCard = card.key === 'grossProfit' || card.key === 'netProfit';
                  const accentColor =
                    (KPI_CARD_SPARKLINE_COLORS as Record<string, string>)[String(card.key)] || KPI_CARD_SPARKLINE_COLORS.sales;
                  const periodLabel = selectedMonthNumber
                    ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]} · ${year}`
                    : String(year);
                  const valueNegative = isProfitCard && val < 0;
                  return (
                    <MetricCard
                      key={`${year}-${selectedMonth || 'all'}-${card.key}`}
                      color={accentColor}
                      className="min-h-[120px]"
                    >
                      <MetricCard.Header label={card.label} />
                      <MetricCard.Value
                        value={amountText(getCardValue(card.key))}
                        currency="SR"
                        color={valueNegative ? 'var(--noorix-accent-red)' : undefined}
                      />
                      <div className="min-h-[10px] flex-1 shrink-0" aria-hidden />
                      <MetricCard.Footer className="mt-3 border-t border-noorix-border pt-3 pb-3">
                        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-noorix-muted">{periodLabel}</span>
                        {profitPct != null && (
                          <span
                            className={cn(
                              'inline-flex max-w-[min(100%,140px)] shrink-0 truncate rounded px-2 py-0.5 text-[11px] font-bold',
                              Number(profitPct) > 0 && 'bg-[#eaf3de] text-[#3B6D11]',
                              Number(profitPct) < 0 && 'bg-[#FCEBEB] text-[#A32D2D]',
                              Number(profitPct) === 0 && 'bg-noorix-bg-muted text-noorix-muted',
                            )}
                          >
                            {t('reportProfitMargin')}: {profitPct}%
                          </span>
                        )}
                      </MetricCard.Footer>
                    </MetricCard>
                  );
                })}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="noorix-surface-card text-center text-noorix-muted p-6">
              {t('loading')}
            </div>
          )}

          {error && (
            <div className="noorix-surface-card p-5 text-noorix-red" style={{ background: 'var(--noorix-red-8)' }}>
              {error.message}
            </div>
          )}

          {!isLoading && !error && report && flatRows.length === 0 && (
            <div className="noorix-surface-card text-center text-noorix-muted p-6">
              {t('reportNoData')}
            </div>
          )}

          {!isLoading && !error && report && visibleRows.length > 0 && (
            <div className="max-w-[min(100%,1400px)] mx-auto">
              <div className="noorix-surface-card overflow-hidden p-0">
                {isMobile && (
                  <ScreenTabs
                    variant="underline"
                    items={mobileMonthTabItems}
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    barClassName="border-b border-noorix-border"
                  />
                )}
                <div className="flex flex-col gap-0 border-b border-noorix-border bg-noorix-bg-muted/30 px-3 py-2.5">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[120px] flex-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-noorix-muted">{t('reportPlToolbarPeriod')}</div>
                      <div className="text-[14px] font-bold text-noorix-text">
                        {selectedMonthNumber
                          ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]} ${year}`
                          : String(year)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {([1, 2, 3] as const).map((lvl) => (
                        <Button
                          key={lvl}
                          size="sm"
                          variant={plDisplayLevel === lvl ? 'primary' : 'default'}
                          type="button"
                          onClick={() => setPlDisplayLevel(lvl)}
                        >
                          {lvl === 1 ? t('reportPlLevel1') : lvl === 2 ? t('reportPlLevel2') : t('reportPlLevel3')}
                        </Button>
                      ))}
                    </div>
                    <Input
                      type="text"
                      size="sm"
                      className="max-w-[220px] min-w-[140px]"
                      label={t('reportPlRowFilterPlaceholder')}
                      value={rowSearch}
                      onChange={(e: any) => setRowSearch(e.target.value)}
                    />
                  </div>
                  <div className="mt-1.5 text-[11px] leading-snug text-noorix-muted">{t('reportPlLevelsHint')}</div>
                </div>
                <GeneralPlTable
                  report={report}
                  visibleRows={visibleRows}
                  collapsedGroups={collapsedGroups}
                  toggleGroup={toggleGroup}
                  lang={lang}
                  t={t}
                  isMobile={isMobile}
                  selectedMonthNumber={selectedMonthNumber}
                  monthNames={lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN}
                  onOpenDetail={(payload) => setDetailState(payload)}
                />
            </div>
            </div>
          )}
        </>
      )}
      </div>
    </ScreenShell>
  );
}
