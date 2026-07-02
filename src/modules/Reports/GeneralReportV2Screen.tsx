import React, { useLayoutEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useReportsGeneralProfitLoss } from '../../hooks/useReports';
import { getSaudiNow } from '../../utils/saudiDate';
import { exportToExcel } from '../../utils/exportUtils';
import ReportsDetailModal from './ReportsDetailModal';
import { InlineSelect, Input } from '../../ui';
import {
  amountText,
  percentText,
  displayLabel,
  buildFlatRows,
  buildVisibleRows,
  buildCollapsedGroupsForLevel,
  filterVisibleRowsByLabel,
  getContextAmount,
  getContextPercent,
  type PlDisplayLevel,
} from './reportHelpers';
import { MONTH_NAMES_AR, MONTH_NAMES_EN, getProfitLossCardRawValue } from './profitLossPresentationModel';
import type { ReportPeriodMode } from './reportTypes';

const GROUP_TONES: Record<string, string> = {
  sales: 'var(--color-nx-sales)',
  purchases: '#991b1b',
  expenses: '#991b1b',
  grossProfit: 'var(--color-nx-profit)',
  netProfit: 'var(--color-nx-net-profit)',
};

const NEGATIVE_GROUPS = new Set(['purchases', 'expenses']);

function escHtml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function groupToneClass(row: any) {
  if (row.rowType === 'groupTotal') return 'is-group-total';
  if (NEGATIVE_GROUPS.has(String(row.groupKey || row.key || ''))) return 'is-negative';
  if (row.rowType === 'summary' && Number(row.total || 0) < 0) return 'is-negative';
  if (row.rowType === 'summary') return 'is-summary';
  return '';
}

function displayV2RowLabel(row: any, lang: string) {
  const label = displayLabel(row, lang);
  if (row.rowType !== 'groupTotal') return label;
  return lang === 'en' ? `Total ${label}` : `مجموع ${label}`;
}

function buildStatementRowsForV2(rows: any[]) {
  const result: any[] = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.rowType !== 'group') {
      if (row.rowType === 'summary') result.push(row);
      continue;
    }
    const children: any[] = [];
    let cursor = index + 1;
    while (cursor < rows.length && rows[cursor].rowType !== 'group' && rows[cursor].rowType !== 'summary') {
      children.push(rows[cursor]);
      cursor++;
    }
    if (children.length) result.push(...children, { ...row, rowType: 'groupTotal', originalRowType: 'group' });
    else result.push(row);
    index = cursor - 1;
  }
  return result;
}

function buildV2ExportRows(rows: any[], opts: {
  lang: string;
  t: (key: string) => string;
  selectedMonthNumber: number | null;
  monthLabel: string;
  year: number;
  monthLabels: string[];
}) {
  const { lang, t, selectedMonthNumber, monthLabel, year, monthLabels } = opts;
  return rows.map((row: any) => {
    const indent = row.rowType === 'groupTotal' || row.rowType === 'summary' || row.rowType === 'group'
      ? ''
      : '  '.repeat((row.depth || 0) + 1);
    const base: Record<string, unknown> = {
      [t('reportItem')]: `${indent}${displayV2RowLabel(row, lang)}`,
    };
    if (selectedMonthNumber) {
      base[`${monthLabel} ${year}`] = amountText(getContextAmount(row, selectedMonthNumber));
      base['%'] = percentText(getContextPercent(row, selectedMonthNumber));
      return base;
    }
    monthLabels.forEach((label, index) => {
      base[label] = amountText(row?.months?.[index]);
    });
    base[t('reportAnnualTotal')] = amountText(row.total);
    base['%'] = percentText(row.percentOfSalesYear);
    return base;
  });
}

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
  const statementRowsBase = useMemo(() => buildStatementRowsForV2(visibleRowsBase), [visibleRowsBase]);
  const visibleRows = useMemo(() => filterVisibleRowsByLabel(statementRowsBase, rowSearch, lang), [statementRowsBase, rowSearch, lang]);

  const kpis = useMemo(() => {
    const sales = getProfitLossCardRawValue(report, 'sales', selectedMonthNumber);
    const purchases = getProfitLossCardRawValue(report, 'purchases', selectedMonthNumber);
    const expenses = getProfitLossCardRawValue(report, 'expenses', selectedMonthNumber);
    const grossProfit = getProfitLossCardRawValue(report, 'grossProfit', selectedMonthNumber);
    const netProfit = getProfitLossCardRawValue(report, 'netProfit', selectedMonthNumber);
    const ratio = (value: number) => (sales ? `${((value / sales) * 100).toFixed(1)}%` : '-');
    return [
      { key: 'sales', label: selectedMonthNumber ? `${t('revenueGroup')} ${monthLabel}` : t('annualSales'), value: sales, meta: selectedMonthNumber ? monthLabel : String(year), tone: GROUP_TONES.sales },
      { key: 'grossProfit', label: t('annualGrossProfit'), value: grossProfit, meta: ratio(grossProfit), tone: GROUP_TONES.grossProfit },
      { key: 'netProfit', label: t('annualNetProfit'), value: netProfit, meta: ratio(netProfit), tone: GROUP_TONES.netProfit },
      { key: 'purchases', label: selectedMonthNumber ? `${t('purchasesGroup')} ${monthLabel}` : t('annualPurchases'), value: purchases, meta: ratio(purchases), tone: GROUP_TONES.purchases },
      { key: 'expenses', label: selectedMonthNumber ? `${t('expensesGroup')} ${monthLabel}` : t('annualExpenses'), value: expenses, meta: ratio(expenses), tone: GROUP_TONES.expenses },
    ];
  }, [monthLabel, report, selectedMonthNumber, t, year]);

  const exportRows = useMemo(() => buildV2ExportRows(visibleRows, {
    lang,
    t,
    selectedMonthNumber,
    monthLabel,
    year,
    monthLabels: report?.months?.map((month: any) => month.label) || monthNames,
  }), [lang, monthLabel, monthNames, report?.months, selectedMonthNumber, t, visibleRows, year]);

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
      money2ColumnKeys: selectedMonthNumber ? [`${monthLabel} ${year}`] : [...(report?.months?.map((month: any) => month.label) || monthNames), t('reportAnnualTotal')],
      moneyColumnFractionDigits: 0,
    });
  }

  function buildPrintableReportHtml() {
    if (!report) return;
    const period = selectedMonthNumber ? `${monthLabel} ${year}` : String(year);
    const monthHeaders = selectedMonthNumber
      ? `<th>${escHtml(monthLabel)}</th>`
      : (report.months || []).map((month: any) => `<th>${escHtml(month.label)}</th>`).join('');
    const rows = visibleRows.map((row: any) => {
      const rowTone = groupToneClass(row);
      const amountClass = rowTone === 'is-negative' ? ' neg' : '';
      const cells = selectedMonthNumber
        ? `<td class="amt${amountClass}">${escHtml(amountText(getContextAmount(row, selectedMonthNumber)))}</td>`
        : (row.months ?? []).map((value: any) => `<td class="amt${amountClass}">${escHtml(amountText(value))}</td>`).join('');
      const total = selectedMonthNumber ? '' : `<td class="amt${amountClass}">${escHtml(amountText(row.total))}</td>`;
      const pct = selectedMonthNumber ? getContextPercent(row, selectedMonthNumber) : row.percentOfSalesYear;
      return `<tr class="${escHtml(row.rowType)} ${escHtml(rowTone)}">
        <td class="label" style="padding-inline-start:${10 + (row.depth || 0) * 14}px">${escHtml(displayV2RowLabel(row, lang))}</td>
        ${cells}
        ${total}
        <td class="pct">${escHtml(percentText(pct))}</td>
      </tr>`;
    }).join('');
    return `<!DOCTYPE html>
<html dir="${lang === 'en' ? 'ltr' : 'rtl'}" lang="${lang === 'en' ? 'en' : 'ar'}">
<head>
<meta charset="utf-8">
<title>${escHtml(t('reportGeneralV2'))}</title>
<style>
@page { size: A4 ${selectedMonthNumber ? 'portrait' : 'landscape'}; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; background: #eef2f7; color: #0f172a; font-family: Cairo, Tahoma, Arial, sans-serif; }
.toolbar { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border-bottom: 1px solid #d8e2ef; }
.toolbar strong { font-size: 14px; }
.toolbar button { border: 1px solid #b9c8da; background: #185fa5; color: #fff; border-radius: 6px; padding: 8px 16px; font-weight: 800; cursor: pointer; }
.sheet { width: ${selectedMonthNumber ? '190mm' : '276mm'}; min-height: ${selectedMonthNumber ? '277mm' : '190mm'}; margin: 18px auto; background: #fff; border: 1px solid #d8e2ef; box-shadow: 0 14px 35px rgba(15,23,42,.12); padding: 14mm; }
.head { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; border-bottom: 3px solid #185fa5; padding-bottom: 12px; margin-bottom: 14px; }
.head h1 { margin: 0; font-size: 22px; line-height: 1.2; font-weight: 900; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.meta span { border: 1px solid #d8e2ef; background: #f8fafc; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 800; color: #334155; }
.brand { text-align: end; font-weight: 900; font-size: 18px; color: #0f172a; }
table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; border: 1px solid #cbd5e1; border-radius: 8px; }
thead th { background: linear-gradient(180deg, #12385f 0%, #0f2746 100%); color: #fff; font-size: 11px; font-weight: 900; padding: 9px 8px; border-inline-end: 1px solid rgba(255,255,255,.14); }
tbody td { padding: 8px; border-top: 1px solid #dbe5f0; border-inline-end: 1px solid #e7eef6; font-size: 11.5px; font-weight: 700; }
tbody tr:nth-child(even) td { background: #f8fafc; }
td.label { text-align: start; font-size: 12px; color: #172033; }
td.amt, td.pct { text-align: center; direction: ltr; font-variant-numeric: tabular-nums; }
td.neg, tr.is-negative td { color: #991b1b; }
tr.groupTotal td { background: #eaf3ff !important; color: #0f3b68; font-weight: 900; border-top: 2px solid #9bc3ea; }
tr.summary td { background: #eaf3ff !important; color: #0f3b68; font-size: 12px; font-weight: 900; border-top: 2px solid #9bc3ea; }
tr.is-summary td.amt { color: #047857; }
.footer { margin-top: 12px; text-align: center; color: #64748b; font-size: 10px; }
@media print {
  body { background: #fff; }
  .toolbar { display: none; }
  .sheet { width: auto; min-height: 0; margin: 0; padding: 0; border: 0; box-shadow: none; }
}
</style>
</head>
<body>
<div class="toolbar"><strong>${escHtml(t('reportGeneralV2'))} - ${escHtml(period)}</strong><button onclick="window.print()">${escHtml(t('print'))}</button></div>
<main class="sheet">
  <header class="head">
    <div>
      <h1>${escHtml(t('reportGeneralV2'))}</h1>
      <div class="meta"><span>${escHtml(period)}</span><span>${escHtml(t('reportAmountBasisGrossShort'))}</span></div>
    </div>
    <div class="brand">${escHtml(companyName || t('reports'))}</div>
  </header>
  <table>
    <thead><tr><th>${escHtml(t('reportItem'))}</th>${monthHeaders}${selectedMonthNumber ? '' : `<th>${escHtml(t('reportAnnualTotal'))}</th>`}<th>%</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">${escHtml(period)}</div>
</main>
</body>
</html>`;
  }

  function openPrintablePreview() {
    const html = buildPrintableReportHtml();
    if (!html) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  function handleExportPdf() {
    openPrintablePreview();
  }

  function handlePrint() {
    openPrintablePreview();
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
          <InlineSelect value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label={t('reportYear')}>
            {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </InlineSelect>
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
                <Input value={rowSearch} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRowSearch(event.target.value)} placeholder={t('reportPlRowFilterPlaceholder')} />
              </div>
            </div>

            <div className="nx-gr2-table-scroll">
              <table className={selectedMonthNumber ? 'nx-gr2-table is-month' : 'nx-gr2-table is-year'}>
                <thead>
                  <tr>
                    <th>{t('reportItem')}</th>
                    {selectedMonthNumber ? <th>{monthLabel}</th> : report.months.map((month) => <th key={month.index}>{month.label}</th>)}
                    {!selectedMonthNumber && <th>{t('reportAnnualTotal')}</th>}
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row: any) => {
                    const canCollapse = row.rowType === 'group' || row.rowType === 'groupTotal' || row.rowType === 'category';
                    const collapseKey = row.rowType === 'group' || row.rowType === 'groupTotal' ? row.groupKey : row.collapseKey;
                    const amount = getContextAmount(row, selectedMonthNumber);
                    const pct = getContextPercent(row, selectedMonthNumber);
                    const rowTone = groupToneClass(row);
                    const rowType = row.originalRowType || row.rowType;
                    return (
                      <tr
                        key={`${row.groupKey}-${row.itemKey || row.key}-${row.rowType}-${row.depth || 0}`}
                        className={rowTone}
                        data-row-type={row.rowType}
                        data-depth={row.depth || 0}
                        data-group={row.groupKey}
                      >
                        <td>
                          <button
                            type="button"
                            className="nx-gr2-line"
                            style={{ paddingInlineStart: row.rowType === 'groupTotal' || row.rowType === 'summary' ? 12 : 12 + ((row.depth || 0) + 1) * 18 }}
                            onClick={() => canCollapse ? toggleGroup(String(collapseKey)) : setDetailState({ month: selectedMonthNumber, groupKey: row.groupKey, itemKey: row.itemKey, showTrend: rowType === 'item' })}
                          >
                            {canCollapse && <span>{collapsedGroups[String(collapseKey)] ? '+' : '-'}</span>}
                            {displayV2RowLabel(row, lang)}
                          </button>
                        </td>
                        {selectedMonthNumber ? (
                          <td>
                            <button type="button" className="nx-gr2-money" onClick={() => setDetailState({ month: selectedMonthNumber, groupKey: row.groupKey, itemKey: row.itemKey, showTrend: rowType === 'item' })}>
                              {amountText(amount)}
                            </button>
                          </td>
                        ) : (
                          (row.months ?? []).map((value: any, index: number) => (
                            <td key={index}>
                              <button type="button" className="nx-gr2-money" onClick={() => setDetailState({ month: index + 1, groupKey: row.groupKey, itemKey: row.itemKey, showTrend: rowType === 'item' })}>
                                {amountText(value)}
                              </button>
                            </td>
                          ))
                        )}
                        {!selectedMonthNumber && <td><span className="nx-gr2-total">{amountText(row.total)}</span></td>}
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
