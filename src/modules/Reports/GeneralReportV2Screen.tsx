import React, { useLayoutEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useReportsGeneralProfitLoss } from '../../hooks/useReports';
import { getSaudiNow } from '../../utils/saudiDate';
import { exportToExcel } from '../../utils/exportUtils';
import ReportsDetailModal from './ReportsDetailModal';
import { Button, FilterToolbar, Input } from '../../ui';
import {
  amountText,
  percentText,
  buildFlatRows,
  buildVisibleRows,
  buildCollapsedGroupsForLevel,
  filterVisibleRowsByLabel,
  getContextAmount,
  getContextPercent,
  type PlDisplayLevel,
} from './reportHelpers';
import { MONTH_NAMES_AR, MONTH_NAMES_EN, getProfitLossCardRawValue } from './profitLossPresentationModel';
import type { PlDisplayRow, ReportDetailState, ReportPeriodMode } from './reportTypes';
import {
  buildPrintableGeneralReportV2Html,
  buildStatementRowsForV2 as buildStatementRowsForV2Model,
  buildV2ExportRows as buildV2ExportRowsModel,
  displayV2RowLabel as displayV2RowLabelModel,
  groupToneClass as groupToneClassModel,
  lineIndentClass as lineIndentClassModel,
} from './generalReportV2Model';
import ReportDateFilter from './ReportDateFilter';

const GROUP_TONE_CLASSES: Record<string, string> = {
  sales: 'nx-gr2-score--sales',
  purchases: 'nx-gr2-score--negative',
  expenses: 'nx-gr2-score--negative',
  grossProfit: 'nx-gr2-score--gross-profit',
  netProfit: 'nx-gr2-score--net-profit',
};

const NEGATIVE_GROUPS = new Set(['purchases', 'expenses']);

function escHtml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function groupToneClass(row: PlDisplayRow) {
  if (row.rowType === 'groupTotal') return 'is-group-total';
  if (NEGATIVE_GROUPS.has(String(row.groupKey || row.key || ''))) return 'is-negative';
  if (row.rowType === 'summary' && Number(row.total || 0) < 0) return 'is-negative';
  if (row.rowType === 'summary') return 'is-summary';
  return '';
}

function lineIndentClass(row: PlDisplayRow) {
  if (row.rowType === 'groupTotal' || row.rowType === 'summary') return 'nx-gr2-line--indent-total';
  const depth = Math.max(0, Math.min(4, Number(row.depth || 0)));
  return `nx-gr2-line--indent-${depth}`;
}

function displayV2RowLabel(row: PlDisplayRow, lang: string) {
  const label = displayV2RowLabelModel(row, lang);
  if (row.rowType !== 'groupTotal') return label;
  return lang === 'en' ? `Total ${label}` : `مجموع ${label}`;
}

function buildStatementRowsForV2(rows: PlDisplayRow[]) {
  const result: PlDisplayRow[] = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.rowType !== 'group') {
      if (row.rowType === 'summary') result.push(row);
      continue;
    }
    const children: PlDisplayRow[] = [];
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

function buildV2ExportRows(rows: PlDisplayRow[], opts: {
  lang: string;
  t: (key: string) => string;
  selectedMonthNumber: number | null;
  monthLabel: string;
  year: number;
  monthLabels: string[];
}) {
  const { lang, t, selectedMonthNumber, monthLabel, year, monthLabels } = opts;
  return rows.map((row) => {
    const indent = row.rowType === 'groupTotal' || row.rowType === 'summary' || row.rowType === 'group'
      ? ''
      : '  '.repeat((row.depth || 0) + 1);
    const base: Record<string, string> = {
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
  const [detailState, setDetailState] = useState<ReportDetailState | null>(null);
  const [displayLevel, setDisplayLevel] = useState<PlDisplayLevel>(2);
  const [rowSearch, setRowSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    sales: false,
    purchases: false,
    expenses: false,
  });
  const company = companies?.find((item) => item.id === activeCompanyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');
  const selectedMonthNumber = periodMode === 'month' ? Number(selectedMonth) : null;
  const monthNames = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
  const monthLabel = selectedMonthNumber ? monthNames[selectedMonthNumber - 1] : '';
  const yearOptions = useMemo(() => Array.from({ length: 6 }, (_, index) => currentYear - index), [currentYear]);

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
  const statementRowsBase = useMemo(() => buildStatementRowsForV2Model(visibleRowsBase), [visibleRowsBase]);
  const visibleRows = useMemo(() => filterVisibleRowsByLabel(statementRowsBase, rowSearch, lang), [statementRowsBase, rowSearch, lang]);

  const kpis = useMemo(() => {
    const sales = getProfitLossCardRawValue(report, 'sales', selectedMonthNumber);
    const purchases = getProfitLossCardRawValue(report, 'purchases', selectedMonthNumber);
    const expenses = getProfitLossCardRawValue(report, 'expenses', selectedMonthNumber);
    const grossProfit = getProfitLossCardRawValue(report, 'grossProfit', selectedMonthNumber);
    const netProfit = getProfitLossCardRawValue(report, 'netProfit', selectedMonthNumber);
    const ratio = (value: number) => (sales ? `${((value / sales) * 100).toFixed(1)}%` : '-');
    return [
      { key: 'sales', label: selectedMonthNumber ? `${t('revenueGroup')} ${monthLabel}` : t('annualSales'), value: sales, meta: selectedMonthNumber ? monthLabel : String(year), toneClass: GROUP_TONE_CLASSES.sales },
      { key: 'grossProfit', label: t('annualGrossProfit'), value: grossProfit, meta: ratio(grossProfit), toneClass: GROUP_TONE_CLASSES.grossProfit },
      { key: 'netProfit', label: t('annualNetProfit'), value: netProfit, meta: ratio(netProfit), toneClass: GROUP_TONE_CLASSES.netProfit },
      { key: 'purchases', label: selectedMonthNumber ? `${t('purchasesGroup')} ${monthLabel}` : t('annualPurchases'), value: purchases, meta: ratio(purchases), toneClass: GROUP_TONE_CLASSES.purchases },
      { key: 'expenses', label: selectedMonthNumber ? `${t('expensesGroup')} ${monthLabel}` : t('annualExpenses'), value: expenses, meta: ratio(expenses), toneClass: GROUP_TONE_CLASSES.expenses },
    ];
  }, [monthLabel, report, selectedMonthNumber, t, year]);

  const exportRows = useMemo(() => buildV2ExportRowsModel(visibleRows, {
    lang,
    t,
    selectedMonthNumber,
    monthLabel,
    year,
    monthLabels: report?.months?.map((month) => month.label) || monthNames,
  }), [lang, monthLabel, monthNames, report?.months, selectedMonthNumber, t, visibleRows, year]);

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

  function openPrintablePreview() {
    if (!report) return;
    const html = buildPrintableGeneralReportV2Html({
      report,
      visibleRows,
      selectedMonthNumber,
      monthLabel,
      year,
      lang,
      t,
      companyName,
    });
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
        <FilterToolbar variant="bare" className="nx-gr2-controls">
          <ReportDateFilter
            onYearChange={setYear}
            onMonthChange={setSelectedMonth}
            onModeChange={setPeriodMode}
          />
          <div className="nx-gr2-actions">
            <Button variant="raw" type="button" onClick={handleExportExcel} disabled={!report}>{t('exportExcel')}</Button>
            <Button variant="raw" type="button" onClick={handleExportPdf} disabled={!report}>PDF</Button>
            <Button variant="raw" type="button" onClick={handlePrint} disabled={!report}>{t('print')}</Button>
          </div>
        </FilterToolbar>
      </header>

      {!activeCompanyId && <div className="nx-gr2-empty">{t('pleaseSelectCompany')}</div>}
      {isLoading && <div className="nx-gr2-empty">{t('loading')}</div>}
      {error && <div className="nx-gr2-empty nx-gr2-empty--error">{error.message}</div>}

      {activeCompanyId && report && (
        <>
          <section className="nx-gr2-scoreboard" aria-label={t('reportPlExecutiveSummary')}>
            {kpis.map((card) => (
              <article key={card.key} className={`nx-gr2-score ${card.toneClass}`}>
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
              <FilterToolbar variant="bare" className="nx-gr2-statement__tools">
                {[1, 2, 3].map((level) => (
                  <Button variant="raw" key={level} type="button" className={displayLevel === level ? 'is-active' : ''} onClick={() => setDisplayLevel(level as PlDisplayLevel)}>
                    {level === 1 ? t('reportPlLevel1') : level === 2 ? t('reportPlLevel2') : t('reportPlLevel3')}
                  </Button>
                ))}
                <Input value={rowSearch} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRowSearch(event.target.value)} placeholder={t('reportPlRowFilterPlaceholder')} />
              </FilterToolbar>
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
                  {visibleRows.map((row: PlDisplayRow) => {
                    const canCollapse = row.rowType === 'group' || row.rowType === 'groupTotal' || row.rowType === 'category';
                    const collapseKey = row.rowType === 'group' || row.rowType === 'groupTotal' ? row.groupKey : row.collapseKey;
                    const amount = getContextAmount(row, selectedMonthNumber);
                    const pct = getContextPercent(row, selectedMonthNumber);
                    const rowTone = groupToneClassModel(row);
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
                          <Button
                            variant="raw"
                            type="button"
                            className={`nx-gr2-line ${lineIndentClassModel(row)}`}
                            onClick={() => canCollapse ? toggleGroup(String(collapseKey)) : openDetail(row, selectedMonthNumber, rowType === 'item')}
                          >
                            {canCollapse && <span>{collapsedGroups[String(collapseKey)] ? '+' : '-'}</span>}
                            {displayV2RowLabelModel(row, lang)}
                          </Button>
                        </td>
                        {selectedMonthNumber ? (
                          <td>
                            <Button variant="raw" type="button" className="nx-gr2-money" onClick={() => openDetail(row, selectedMonthNumber, rowType === 'item')}>
                              {amountText(amount)}
                            </Button>
                          </td>
                        ) : (
                          (row.months ?? []).map((value, index) => (
                            <td key={index}>
                              <Button variant="raw" type="button" className="nx-gr2-money" onClick={() => openDetail(row, index + 1, rowType === 'item')}>
                                {amountText(value)}
                              </Button>
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
