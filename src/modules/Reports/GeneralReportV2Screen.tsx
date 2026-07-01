import React, { useLayoutEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useReportsGeneralProfitLoss } from '../../hooks/useReports';
import { getSaudiNow } from '../../utils/saudiDate';
import { exportTableToPdf, exportToExcel } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import ReportsDetailModal from './ReportsDetailModal';
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
  getContextAmount,
  getContextPercent,
  type PlDisplayLevel,
} from './reportHelpers';
import { MONTH_NAMES_AR, MONTH_NAMES_EN, getProfitLossCardRawValue } from './profitLossPresentationModel';
import { profitLossPdfExportExtraCss } from './reportsPlExportPdfCss';
import type { ReportPeriodMode } from './reportTypes';

const GROUP_TONES: Record<string, string> = {
  sales: 'var(--color-nx-sales)',
  purchases: 'var(--color-nx-purchases)',
  expenses: 'var(--color-nx-expenses)',
  grossProfit: 'var(--color-nx-profit)',
  netProfit: 'var(--color-nx-net-profit)',
};

export default function GeneralReportV2Screen() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const currentYear = getSaudiNow().year;
  const [year, setYear] = useState(currentYear);
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('year');
  const [selectedMonth, setSelectedMonth] = useState(String(getSaudiNow().month));
  const [detailState, setDetailState] = useState<any>(null);
  const [displayLevel, setDisplayLevel] = useState<PlDisplayLevel>(2);
  const [rowSearch, setRowSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    sales: false,
    purchases: false,
    expenses: false,
  });
  const company = companies?.find((item: any) => item.id === activeCompanyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');
  const selectedMonthNumber = periodMode === 'month' ? Number(selectedMonth) : null;
  const monthNames = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
  const monthLabel = selectedMonthNumber ? monthNames[selectedMonthNumber - 1] : '';
  const yearOptions = useMemo(() => Array.from({ length: 6 }, (_: any, index: number) => currentYear - index), [currentYear]);

  const { data: report, isLoading, error, isFetching, isPlaceholderData } = useReportsGeneralProfitLoss({
    companyId: activeCompanyId,
    year,
  });

  useLayoutEffect(() => {
    if (!report) return;
    setCollapsedGroups(buildCollapsedGroupsForLevel(report, displayLevel));
  }, [report, year, activeCompanyId, displayLevel]);

  const flatRows = useMemo(() => buildFlatRows(report, collapsedGroups), [report, collapsedGroups]);
  const visibleRowsBase = useMemo(() => buildVisibleRows(flatRows, collapsedGroups), [flatRows, collapsedGroups]);
  const visibleRows = useMemo(() => filterVisibleRowsByLabel(visibleRowsBase, rowSearch, lang), [visibleRowsBase, rowSearch, lang]);

  const kpis = useMemo(() => {
    const sales = getProfitLossCardRawValue(report, 'sales', selectedMonthNumber);
    const purchases = getProfitLossCardRawValue(report, 'purchases', selectedMonthNumber);
    const expenses = getProfitLossCardRawValue(report, 'expenses', selectedMonthNumber);
    const grossProfit = getProfitLossCardRawValue(report, 'grossProfit', selectedMonthNumber);
    const netProfit = getProfitLossCardRawValue(report, 'netProfit', selectedMonthNumber);
    const ratio = (value: number) => (sales ? `${((value / sales) * 100).toFixed(1)}%` : '-');
    return [
      { key: 'sales', label: t('annualSales'), value: sales, meta: selectedMonthNumber ? monthLabel : String(year), tone: GROUP_TONES.sales },
      { key: 'grossProfit', label: t('annualGrossProfit'), value: grossProfit, meta: ratio(grossProfit), tone: GROUP_TONES.grossProfit },
      { key: 'netProfit', label: t('annualNetProfit'), value: netProfit, meta: ratio(netProfit), tone: GROUP_TONES.netProfit },
      { key: 'purchases', label: t('annualPurchases'), value: purchases, meta: ratio(purchases), tone: GROUP_TONES.purchases },
      { key: 'expenses', label: t('annualExpenses'), value: expenses, meta: ratio(expenses), tone: GROUP_TONES.expenses },
    ];
  }, [monthLabel, report, selectedMonthNumber, t, year]);

  const { exportRows, plExportRowMeta } = useMemo(() => {
    if (!report) return { exportRows: [] as Record<string, unknown>[], plExportRowMeta: [] as ReturnType<typeof buildProfitLossExportRowMeta> };
    const rows = buildExportRowsFromVisibleRows(
      visibleRowsBase,
      lang,
      t,
      selectedMonthNumber,
      selectedMonthNumber ? { amountColumnTitle: `${monthLabel} ${year}` } : undefined,
    );
    return {
      exportRows: rows,
      plExportRowMeta: buildProfitLossExportRowMeta(report, selectedMonthNumber, visibleRowsBase),
    };
  }, [lang, monthLabel, report, selectedMonthNumber, t, visibleRowsBase, year]);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
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
      profitLossRowMeta: plExportRowMeta,
      money2ColumnKeys: [t('revenueGroup'), t('purchasesGroup'), t('expensesGroup'), ...EN_MONTHS, t('reportAnnualTotal')],
      moneyColumnFractionDigits: 0,
    });
  }

  function handleExportPdf() {
    if (!report) return;
    exportTableToPdf({
      companyName: companyName || t('reports'),
      title: selectedMonthNumber ? `${t('reportIncomeStatementTitle')} - ${monthLabel} ${year}` : `${t('reportGeneralV2')} - ${year}`,
      filename: `general-profit-loss-v2-${year}${selectedMonthNumber ? `-m${selectedMonthNumber}` : ''}.pdf`,
      landscape: !selectedMonthNumber,
      data: exportRows,
      extraCss: profitLossPdfExportExtraCss(),
      htmlDir: lang === 'en' ? 'ltr' : 'rtl',
      htmlLang: lang === 'en' ? 'en' : 'ar',
      showPageCounter: !selectedMonthNumber,
      pdfRowMetas: plExportRowMeta,
    });
  }

  function handlePrint() {
    if (!report) return;
    const esc = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const headers = selectedMonthNumber
      ? `<th>${esc(monthLabel)}</th><th>${esc(t('reportAnnualTotal'))}</th><th>%</th>`
      : `${EN_MONTHS.map((m) => `<th>${esc(m)}</th>`).join('')}<th>${esc(t('reportAnnualTotal'))}</th><th>%</th>`;
    const rows = visibleRowsBase.map((row: any) => {
      const name = esc(displayLabel(row, lang));
      const cells = selectedMonthNumber
        ? `<td>${amountText(getContextAmount(row, selectedMonthNumber))}</td><td>${amountText(row.total)}</td><td>${percentText(getContextPercent(row, selectedMonthNumber))}</td>`
        : `${(row.months ?? []).map((value: any) => `<td>${amountText(value)}</td>`).join('')}<td>${amountText(row.total)}</td><td>${percentText(row.percentOfSalesYear)}</td>`;
      return `<tr><td>${name}</td>${cells}</tr>`;
    }).join('');
    openPrintWindow({
      title: t('reportGeneralV2'),
      companyName: companyName || t('reports'),
      subtitle: selectedMonthNumber ? `${monthLabel} ${year}` : String(year),
      landscape: !selectedMonthNumber,
      htmlLang: lang === 'en' ? 'en' : 'ar',
      htmlDir: lang === 'en' ? 'ltr' : 'rtl',
      body: `<table><thead><tr><th>${esc(t('reportItem'))}</th>${headers}</tr></thead><tbody>${rows}</tbody></table>`,
    });
  }

  return (
    <div className="nx-gr2">
      <ReportsDetailModal state={detailState} onClose={() => setDetailState(null)} companyId={activeCompanyId} year={year} t={t} lang={lang} />

      <header className="nx-gr2-hero">
        <div className="nx-gr2-hero__copy">
          <div className="nx-gr2-kicker">{t('reportIncomeStatementTitle')}</div>
          <h2>{t('reportGeneralV2')}</h2>
          <div className="nx-gr2-meta">
            <span>{companyName || t('reports')}</span>
            <span>{selectedMonthNumber ? `${monthLabel} ${year}` : year}</span>
            <span>{t('reportAmountBasisGrossShort')}</span>
          </div>
        </div>
        <div className="nx-gr2-controls">
          <select value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label={t('reportYear')}>
            {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <div className="nx-gr2-segment" role="group" aria-label={t('reportPlToolbarPeriod')}>
            <button type="button" className={periodMode === 'year' ? 'is-active' : ''} onClick={() => setPeriodMode('year')}>{t('reportPeriodYear')}</button>
            <button type="button" className={periodMode === 'month' ? 'is-active' : ''} onClick={() => setPeriodMode('month')}>{t('reportPeriodMonth')}</button>
          </div>
          <div className="nx-gr2-actions">
            <button type="button" onClick={handleExportExcel} disabled={!report}>{t('exportExcel')}</button>
            <button type="button" onClick={handleExportPdf} disabled={!report}>PDF</button>
            <button type="button" onClick={handlePrint} disabled={!report}>{t('print')}</button>
          </div>
        </div>
      </header>

      {periodMode === 'month' && (
        <div className="nx-gr2-months" aria-label={t('reportMonth')}>
          {monthNames.map((name, index) => (
            <button key={name} type="button" className={selectedMonth === String(index + 1) ? 'is-active' : ''} onClick={() => setSelectedMonth(String(index + 1))}>
              {name}
            </button>
          ))}
        </div>
      )}

      {!activeCompanyId && <div className="nx-gr2-empty">{t('pleaseSelectCompany')}</div>}
      {isLoading && <div className="nx-gr2-empty">{t('loading')}</div>}
      {error && <div className="nx-gr2-empty nx-gr2-empty--error">{error.message}</div>}

      {activeCompanyId && report && (
        <>
          <section className="nx-gr2-scoreboard" aria-label={t('reportPlExecutiveSummary')}>
            {kpis.map((card) => (
              <article key={card.key} className="nx-gr2-score" style={{ '--tone': card.tone } as React.CSSProperties}>
                <span>{card.label}</span>
                <strong dir="ltr">{amountText(card.value)} <small>SR</small></strong>
                <em>{card.meta}</em>
              </article>
            ))}
          </section>

          <section className={isFetching && isPlaceholderData ? 'nx-gr2-statement is-muted' : 'nx-gr2-statement'}>
            <div className="nx-gr2-statement__bar">
              <div>
                <span>{t('reportPlToolbarPeriod')}</span>
                <strong>{selectedMonthNumber ? `${monthLabel} ${year}` : year}</strong>
              </div>
              <div className="nx-gr2-statement__tools">
                {[1, 2, 3].map((level) => (
                  <button key={level} type="button" className={displayLevel === level ? 'is-active' : ''} onClick={() => setDisplayLevel(level as PlDisplayLevel)}>
                    {level === 1 ? t('reportPlLevel1') : level === 2 ? t('reportPlLevel2') : t('reportPlLevel3')}
                  </button>
                ))}
                <input value={rowSearch} onChange={(event) => setRowSearch(event.target.value)} placeholder={t('reportPlRowFilterPlaceholder')} />
              </div>
            </div>

            <div className="nx-gr2-table-scroll">
              <table className="nx-gr2-table">
                <thead>
                  <tr>
                    <th>{t('reportItem')}</th>
                    {selectedMonthNumber ? <th>{monthLabel}</th> : report.months.map((month) => <th key={month.index}>{month.label}</th>)}
                    <th>{t('reportAnnualTotal')}</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row: any) => {
                    const canCollapse = row.rowType === 'group' || row.rowType === 'category';
                    const collapseKey = row.rowType === 'group' ? row.groupKey : row.collapseKey;
                    const amount = getContextAmount(row, selectedMonthNumber);
                    const pct = getContextPercent(row, selectedMonthNumber);
                    return (
                      <tr key={`${row.groupKey}-${row.itemKey || row.key}-${row.depth || 0}`} data-row-type={row.rowType} data-group={row.groupKey}>
                        <td>
                          <button
                            type="button"
                            className="nx-gr2-line"
                            style={{ paddingInlineStart: 12 + (row.depth || 0) * 18 }}
                            onClick={() => canCollapse ? toggleGroup(String(collapseKey)) : setDetailState({ month: selectedMonthNumber, groupKey: row.groupKey, itemKey: row.itemKey, showTrend: row.rowType === 'item' })}
                          >
                            {canCollapse && <span>{collapsedGroups[String(collapseKey)] ? '+' : '-'}</span>}
                            {displayLabel(row, lang)}
                          </button>
                        </td>
                        {selectedMonthNumber ? (
                          <td>
                            <button type="button" className="nx-gr2-money" onClick={() => setDetailState({ month: selectedMonthNumber, groupKey: row.groupKey, itemKey: row.itemKey, showTrend: row.rowType === 'item' })}>
                              {amountText(amount)}
                            </button>
                          </td>
                        ) : (
                          (row.months ?? []).map((value: any, index: number) => (
                            <td key={index}>
                              <button type="button" className="nx-gr2-money" onClick={() => setDetailState({ month: index + 1, groupKey: row.groupKey, itemKey: row.itemKey, showTrend: row.rowType === 'item' })}>
                                {amountText(value)}
                              </button>
                            </td>
                          ))
                        )}
                        <td><span className="nx-gr2-total">{amountText(row.total)}</span></td>
                        <td><span className="nx-gr2-pct">{percentText(selectedMonthNumber ? pct : row.percentOfSalesYear)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
