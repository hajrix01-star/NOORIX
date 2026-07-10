import React, { useLayoutEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useReportsGeneralProfitLoss } from '../../hooks/useReports';
import { exportToExcel } from '../../utils/exportUtils';
import { buildPrintDocumentHtml } from '../../utils/printUtils';
import ReportsDetailModal from './ReportsDetailModal';
import { Badge, Button, FilterToolbar, Input, MetricCard, PrintPreviewModal, SimpleTable } from '../../ui';
import type { SimpleTableColumn } from '../../ui';
import { DateFilterBar, useDateFilter } from '../../ui/date';
import {
  amountText,
  percentText,
  buildFlatRows,
  buildVisibleRows,
  buildCollapsedGroupsForLevel,
  filterVisibleRowsByLabel,
  type PlDisplayLevel,
} from './reportHelpers';
import { MONTH_NAMES_AR, MONTH_NAMES_EN, getProfitLossCardRawValue, type ProfitLossKpiKey } from './profitLossPresentationModel';
import type { GeneralProfitLossReport, PlDisplayRow, ReportDetailState } from './reportTypes';
import {
  buildStatementRowsForV2 as buildStatementRowsForV2Model,
  buildV2ExportRows as buildV2ExportRowsModel,
  displayV2RowLabel as displayV2RowLabelModel,
  groupToneClass as groupToneClassModel,
} from './generalReportV2Model';
import type { DatePeriodState } from '../../utils/datePeriod';

type ComparablePeriod = {
  mode: 'all' | 'month' | 'months' | 'quarter' | 'year';
  year: number;
  month: number | null;
  monthStart: number;
  monthEnd: number;
};

function deriveComparablePeriod(state: DatePeriodState): ComparablePeriod {
  if (state.mode === 'all') {
    return { mode: 'all', year: state.selYear, month: null, monthStart: 1, monthEnd: 12 };
  }
  if (state.mode === 'year') {
    return { mode: 'year', year: state.selYear, month: null, monthStart: 1, monthEnd: 12 };
  }
  if (state.mode === 'quarter') {
    const start = (state.selQuarter - 1) * 3 + 1;
    return { mode: 'quarter', year: state.selYear, month: null, monthStart: start, monthEnd: start + 2 };
  }
  if (state.mode === 'month' || state.mode === 'months') {
    const sameMonth =
      state.monthRangeStartYear === state.monthRangeEndYear &&
      state.monthRangeStartMonth === state.monthRangeEndMonth;
    return {
      mode: sameMonth ? 'month' : 'months',
      year: state.monthRangeStartYear || state.selYear,
      month: sameMonth ? state.monthRangeStartMonth : null,
      monthStart: Math.min(state.monthRangeStartMonth, state.monthRangeEndMonth),
      monthEnd: Math.max(state.monthRangeStartMonth, state.monthRangeEndMonth),
    };
  }
  return { mode: 'month', year: state.selYear, month: state.selMonth, monthStart: state.selMonth, monthEnd: state.selMonth };
}

function numericAmount(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function periodAmount(row: PlDisplayRow, period: ComparablePeriod) {
  if (period.mode === 'year' || period.mode === 'all') return numericAmount(row.total);
  if (period.mode === 'month' && period.month) return numericAmount(row.months?.[period.month - 1]);
  let total = 0;
  for (let month = period.monthStart; month <= period.monthEnd; month++) {
    total += numericAmount(row.months?.[month - 1]);
  }
  return total;
}

function cardAmount(report: GeneralProfitLossReport | null | undefined, key: ProfitLossKpiKey, period: ComparablePeriod) {
  if (period.mode === 'year' || period.mode === 'all') return getProfitLossCardRawValue(report, key, null);
  if (period.mode === 'month' && period.month) return getProfitLossCardRawValue(report, key, period.month);
  const row = [
    ...(report?.groups || []),
    ...(report?.summaryRows || []),
  ].find((item) => item.key === key);
  if (!row) return 0;
  let total = 0;
  for (let month = period.monthStart; month <= period.monthEnd; month++) {
    total += numericAmount(row.months?.[month - 1]);
  }
  return total;
}

function escHtml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default function GeneralReportV2Screen() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const dateFilter = useDateFilter();
  const compareFilter = useDateFilter();
  const currentPeriod = useMemo(() => deriveComparablePeriod(dateFilter.state), [dateFilter.state]);
  const comparePeriod = useMemo(() => deriveComparablePeriod(compareFilter.state), [compareFilter.state]);
  const compareEnabled = comparePeriod.mode !== 'all';
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
    const map = new Map<string, PlDisplayRow>();
    for (const row of buildStatementRowsForV2Model(buildVisibleRows(compareFlatRows, collapsedGroups))) {
      map.set(`${row.groupKey || ''}:${row.itemKey || row.key || ''}:${row.rowType || ''}:${row.depth || 0}`, row);
    }
    return map;
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

  const rowKey = (row: PlDisplayRow) => `${row.groupKey || ''}:${row.itemKey || row.key || ''}:${row.rowType || ''}:${row.depth || 0}`;

  function formatChange(current: number, previous: number) {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return '-';
    if (previous === 0) {
      if (current === 0) return '-';
      return current > 0 ? (lang === 'ar' ? 'جديد' : 'New') : (lang === 'ar' ? 'بدون أساس' : 'No base');
    }
    const value = ((current - previous) / Math.abs(previous)) * 100;
    const rounded = Math.round(value * 10) / 10;
    return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }

  function tableRowClass(row: PlDisplayRow) {
    const rowTone = groupToneClassModel(row);
    if (row.rowType === 'summary') return rowTone ? 'bg-slate-300/80 font-black' : 'bg-slate-200/90 font-black';
    if (row.rowType === 'groupTotal') return 'bg-slate-200/90 font-black';
    return 'bg-white';
  }

  function valueClass(_value: number, row: PlDisplayRow) {
    if (row.rowType === 'summary' || row.rowType === 'groupTotal') return 'text-slate-700';
    return 'text-slate-700';
  }

  const isYearTable = currentPeriod.mode === 'year';
  const reportMonthCount = report?.months?.length || 12;
  const labelColumnMinWidth = isYearTable ? 320 : compareEnabled ? 300 : 260;

  const labelColumn = useMemo<SimpleTableColumn<PlDisplayRow>>(() => ({
    key: 'label',
    label: '',
    minWidth: labelColumnMinWidth,
    align: 'start',
    headerClassName: 'text-start',
    cellClassName: 'text-start',
    render: (_value, row) => {
      const canCollapse = row.rowType === 'group' || row.rowType === 'groupTotal' || row.rowType === 'category';
      const collapseKey = row.rowType === 'group' || row.rowType === 'groupTotal' ? row.groupKey : row.collapseKey;
      const rowType = row.originalRowType || row.rowType;
      const depth = row.rowType === 'summary' || row.rowType === 'groupTotal' ? 0 : Math.max(0, Math.min(3, Number(row.depth || 0)));
      const indent = depth >= 2
        ? isYearTable ? 'ps-28' : 'ps-14'
        : depth === 1
          ? isYearTable ? 'ps-16' : 'ps-8'
          : 'ps-0';
      const labelClass = row.rowType === 'summary' || row.rowType === 'groupTotal'
        ? 'font-black text-slate-900'
        : depth >= 2
          ? 'font-semibold text-slate-500'
          : depth === 1
            ? 'font-semibold text-slate-700'
            : 'font-semibold text-slate-950';
      return (
        <div className={indent}>
          <Button
            variant="raw"
            type="button"
            className={`inline-flex items-center gap-2 p-0 text-start ${labelClass}`}
            onClick={() => canCollapse ? toggleGroup(String(collapseKey)) : openDetail(row, selectedMonthNumber, rowType === 'item')}
          >
            {canCollapse ? <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-[11px]">{collapsedGroups[String(collapseKey)] ? '+' : '-'}</span> : null}
            {!canCollapse && depth === 1 ? <span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> : null}
            {!canCollapse && depth >= 2 ? <span className="h-px w-5 bg-slate-300" /> : null}
            <span>{displayV2RowLabelModel(row, lang)}</span>
          </Button>
        </div>
      );
    },
  }), [collapsedGroups, isYearTable, labelColumnMinWidth, lang, selectedMonthNumber]);

  const comparisonColumns = useMemo<SimpleTableColumn<PlDisplayRow>[]>(() => {
    const columns: SimpleTableColumn<PlDisplayRow>[] = [
      labelColumn,
      {
        key: 'current',
        label: (
          <div className="grid gap-0.5 text-center">
            <span className="font-black text-white">{year}</span>
            <span className="max-w-[140px] truncate text-[11px] font-black text-white/75">{dateFilter.label}</span>
          </div>
        ),
        numeric: true,
        width: 160,
        align: 'end',
        headerClassName: 'text-center',
        cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
        render: (_value, row) => {
          const current = periodAmount(row, currentPeriod);
          return <span className={`inline-block min-w-[116px] text-end font-black ${valueClass(current, row)}`} dir="ltr">{amountText(current)}</span>;
        },
      },
    ];
    if (!compareEnabled) return columns;
    columns.push(
      {
        key: 'compare',
        label: (
          <div className="grid gap-0.5 text-center">
            <span className="font-black text-white">{comparePeriod.year}</span>
            <span className="max-w-[140px] truncate text-[11px] font-black text-white/75">{compareFilter.label}</span>
          </div>
        ),
        numeric: true,
        width: 160,
        align: 'end',
        headerClassName: 'text-center',
        cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
        render: (_value, row) => {
          const compareRow = compareRows.get(rowKey(row));
          const previous = compareRow ? periodAmount(compareRow, comparePeriod) : 0;
          return <span className={`inline-block min-w-[116px] text-end font-black ${valueClass(previous, row)}`} dir="ltr">{compareRow ? amountText(previous) : '-'}</span>;
        },
      },
      {
        key: 'change',
        label: (
          <div className="grid gap-0.5 text-center">
            <span className="font-black text-white">%</span>
            <span className="text-[11px] font-black text-white/75">{lang === 'ar' ? 'التغير' : 'Change'}</span>
          </div>
        ),
        numeric: true,
        width: 120,
        align: 'end',
        headerClassName: 'text-center',
        cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
        render: (_value, row) => {
          const compareRow = compareRows.get(rowKey(row));
          const current = periodAmount(row, currentPeriod);
          const previous = compareRow ? periodAmount(compareRow, comparePeriod) : 0;
          return <span className="inline-block min-w-[78px] text-end font-black text-slate-500" dir="ltr">{compareRow ? formatChange(current, previous) : '-'}</span>;
        },
      },
    );
    return columns;
  }, [compareEnabled, compareFilter.label, comparePeriod, compareRows, currentPeriod, dateFilter.label, labelColumn, lang, year]);

  const yearlyColumns = useMemo<SimpleTableColumn<PlDisplayRow>[]>(() => [
    labelColumn,
    ...(report?.months || []).map((month): SimpleTableColumn<PlDisplayRow> => ({
      key: `m${month.index}`,
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-white">{month.label}</span>
          <span className="text-[11px] font-black text-white/75">{year}</span>
        </div>
      ),
      numeric: true,
      width: 112,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const value = numericAmount(row.months?.[month.index - 1]);
        return (
          <Button variant="raw" type="button" className={`inline-block min-w-[86px] p-0 text-end font-black ${valueClass(value, row)}`} onClick={() => openDetail(row, month.index, (row.originalRowType || row.rowType) === 'item')} dir="ltr">
            {amountText(value)}
          </Button>
        );
      },
    })),
    {
      key: 'total',
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-white">{t('reportAnnualTotal')}</span>
          <span className="text-[11px] font-black text-white/75">{year}</span>
        </div>
      ),
      numeric: true,
      width: 132,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const value = numericAmount(row.total);
        return <span className={`inline-block min-w-[104px] text-end font-black ${valueClass(value, row)}`} dir="ltr">{amountText(value)}</span>;
      },
    },
    {
      key: 'percent',
      label: '%',
      numeric: true,
      width: 96,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => <span className="inline-block min-w-[72px] text-end font-black text-slate-500" dir="ltr">{percentText(row.percentOfSalesYear)}</span>,
    },
  ], [labelColumn, report?.months, t, year]);

  const activeColumns = isYearTable ? yearlyColumns : comparisonColumns;
  const tableMinWidth = isYearTable
    ? Math.max(980, labelColumnMinWidth + reportMonthCount * 112 + 132 + 96)
    : compareEnabled
      ? labelColumnMinWidth + 160 + 160 + 120
      : Math.max(480, labelColumnMinWidth + 160);

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
    const isArabic = lang !== 'en';
    const isYear = currentPeriod.mode === 'year';
    const periodTitle = dateFilter.label;
    const compareTitle = compareEnabled ? compareFilter.label : '';
    const headerCells = isYear
      ? [
          t('reportItem'),
          ...(report?.months || []).map((month) => month.label),
          t('reportAnnualTotal'),
          '%',
        ]
      : [
          t('reportItem'),
          `${year} ${periodTitle}`,
          ...(compareEnabled ? [`${comparePeriod.year} ${compareTitle}`, '%'] : []),
        ];
    const rowsHtml = visibleRows.map((row) => {
      const tone = groupToneClassModel(row);
      const rowKind = row.rowType === 'summary' || row.rowType === 'groupTotal' ? ' total-row' : tone ? ` ${tone}` : '';
      const depth = row.rowType === 'summary' || row.rowType === 'groupTotal' ? 0 : Math.max(0, Math.min(3, Number(row.depth || 0)));
      const label = escHtml(displayV2RowLabelModel(row, lang));
      const cells = isYear
        ? [
            ...(report?.months || []).map((month) => amountText(row.months?.[month.index - 1])),
            amountText(row.total),
            percentText(row.percentOfSalesYear),
          ]
        : (() => {
            const current = periodAmount(row, currentPeriod);
            if (!compareEnabled) return [amountText(current)];
            const compareRow = compareRows.get(rowKey(row));
            const previous = compareRow ? periodAmount(compareRow, comparePeriod) : 0;
            return [
              amountText(current),
              compareRow ? amountText(previous) : '-',
              compareRow ? formatChange(current, previous) : '-',
            ];
          })();
      return `<tr class="${rowKind.trim()}"><td class="label" style="padding-inline-start:${12 + depth * 22}px">${label}</td>${cells.map((cell) => `<td class="num">${escHtml(cell)}</td>`).join('')}</tr>`;
    }).join('');
    const printBody = `
<main class="gr-v2-print-sheet">
  <section class="gr-v2-print-title">
    <div>
      <h1>${escHtml(t('reportGeneralV2'))}</h1>
      <div class="gr-v2-print-meta">
        <span>${escHtml(periodTitle)}</span>
        ${compareEnabled ? `<span>${escHtml(isArabic ? 'مقارنة مع' : 'Compared with')} ${escHtml(compareTitle)}</span>` : ''}
        <span>${escHtml(t('reportAmountBasisGrossShort'))}</span>
      </div>
    </div>
  </section>
  <section class="gr-v2-print-summary">
    <div><span>${escHtml(t('annualNetProfit'))}</span><strong>${escHtml(amountText(currentNetProfit))} SR</strong></div>
    <div><span>${escHtml(t('annualGrossProfit'))}</span><strong>${escHtml(amountText(currentGrossProfit))} SR</strong></div>
    <div><span>${escHtml(isArabic ? 'هامش الربح' : 'Profit margin')}</span><strong>${escHtml(percentText(currentMargin))}</strong></div>
  </section>
  <table class="gr-v2-print-table">
    <thead><tr>${headerCells.map((cell) => `<th>${escHtml(cell)}</th>`).join('')}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="gr-v2-print-note">${escHtml(periodTitle)}${compareEnabled ? ` | ${escHtml(compareTitle)}` : ''}</div>
</main>`;
    const printCss = `
.print-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  text-align: start;
  border-bottom-width: 3px;
}
.print-header img {
  margin: 0;
  width: 54px;
  height: 54px;
  object-fit: contain;
  border: 1px solid #d8e2ef;
  border-radius: 10px;
  padding: 5px;
}
.print-header h1 { font-size: 18px; color: #0f172a; }
.gr-v2-print-sheet {
  width: ${isYear ? '276mm' : '190mm'};
  max-width: 100%;
  margin: 0 auto;
}
.gr-v2-print-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.gr-v2-print-title h1 {
  margin: 0;
  color: #0f172a;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 900;
}
.gr-v2-print-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.gr-v2-print-meta span {
  border: 1px solid #d8e2ef;
  background: #f8fafc;
  border-radius: 999px;
  padding: 4px 10px;
  color: #334155;
  font-size: 11px;
  font-weight: 800;
}
.gr-v2-print-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.gr-v2-print-summary div {
  border: 1px solid #d8e2ef;
  background: #f8fafc;
  border-radius: 8px;
  padding: 10px;
}
.gr-v2-print-summary span {
  display: block;
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
}
.gr-v2-print-summary strong {
  display: block;
  margin-top: 4px;
  direction: ltr;
  text-align: center;
  color: #0f172a;
  font-size: 15px;
  font-weight: 900;
}
.gr-v2-print-table {
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
}
.gr-v2-print-table thead { display: table-header-group; }
.gr-v2-print-table th {
  background: #1d5fa7;
  color: #fff;
  border-color: rgba(255,255,255,.2);
  padding: 9px 8px;
  text-align: center;
  font-size: 11px;
  font-weight: 900;
}
.gr-v2-print-table td {
  border-color: #dbe5f0;
  padding: 8px;
  font-size: 11.5px;
  font-weight: 800;
  page-break-inside: avoid;
}
.gr-v2-print-table tr:nth-child(even) td { background: #f8fafc; }
.gr-v2-print-table td.label {
  text-align: start;
  color: #172033;
}
.gr-v2-print-table td.num {
  direction: ltr;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.gr-v2-print-table tr.total-row td,
.gr-v2-print-table tr.is-group-total td,
.gr-v2-print-table tr.is-summary td {
  background: #e2e8f0 !important;
  color: #0f172a;
  font-weight: 900;
}
.gr-v2-print-note {
  margin-top: 12px;
  text-align: center;
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
}
@media print {
  .gr-v2-print-sheet {
    width: auto;
    max-width: none;
  }
}
`;
    return buildPrintDocumentHtml({
      title: t('reportGeneralV2'),
      companyName: companyName || t('reports'),
      subtitle: compareEnabled ? `${periodTitle} | ${compareTitle}` : periodTitle,
      logoUrl: companyLogoUrl,
      landscape: isYear,
      body: printBody,
      extraCss: printCss,
      htmlDir: isArabic ? 'rtl' : 'ltr',
      htmlLang: isArabic ? 'ar' : 'en',
      autoPrint: true,
      pageMarginMm: 10,
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
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-black text-slate-500">{lang === 'ar' ? 'الفترة' : 'Period'}</span>
              <DateFilterBar filter={dateFilter} modes={['month', 'months', 'quarter', 'year']} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-black text-slate-500">{lang === 'ar' ? 'المقارنة' : 'Compare with'}</span>
              <DateFilterBar filter={compareFilter} modes={['all', 'month', 'months', 'quarter', 'year']} />
            </div>
          </div>
        </FilterToolbar>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.5fr)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="blue" size="sm">{t('reportIncomeStatementTitle')}</Badge>
              <Badge color="gray" size="sm">{companyName || t('reports')}</Badge>
            </div>
            <h2 className="m-0 mt-3 text-[22px] font-black text-noorix-text">{t('reportGeneralV2')}</h2>
            <div className="mt-3 text-[12px] font-bold text-noorix-muted">{dateFilter.label}</div>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              <MetricCard.Header label={lang === 'ar' ? 'المقارنة' : 'Comparison'} subLabel={compareEnabled ? compareFilter.label : (lang === 'ar' ? 'معطلة' : 'Off')} />
              <MetricCard.Value
                value={compareEnabled ? formatChange(currentNetProfit, compareNetProfit) : (lang === 'ar' ? 'بدون' : 'Off')}
                color={compareEnabled ? 'var(--color-nx-profit)' : 'var(--noorix-muted)'}
              />
              <MetricCard.Footer className="mt-auto border-t border-noorix-border px-4 py-2 text-[11px] font-bold text-noorix-muted">
                {compareEnabled ? `${lang === 'ar' ? 'مقارنة مع' : 'Compared with'} ${compareFilter.label}` : (lang === 'ar' ? 'لا تظهر أعمدة المقارنة' : 'Comparison columns hidden')}
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
            <Button size="sm" type="button" onClick={handleExportExcel} disabled={!report}>{t('exportExcel')}</Button>
            <Button size="sm" type="button" onClick={handlePrintPdf} disabled={!report}>{t('print')} / PDF</Button>
          </div>
        </div>
      </section>

      {!activeCompanyId && <div className="rounded-lg border border-noorix-border bg-white p-5 text-center text-noorix-muted">{t('pleaseSelectCompany')}</div>}
      {(isLoading || (compareEnabled && isFetchingCompare)) && <div className="rounded-lg border border-noorix-border bg-white p-5 text-center text-noorix-muted">{t('loading')}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-center font-bold text-red-700">{error.message}</div>}

      {activeCompanyId && report && (
        <section className={isFetching && isPlaceholderData ? 'opacity-70' : undefined}>
          <SimpleTable
            columns={activeColumns}
            data={visibleRows}
            tableMinWidth={tableMinWidth}
            frameClassName={isYearTable ? '' : 'noorix-report-table--fit'}
            tableClassName={isYearTable ? '' : 'noorix-report-table__table'}
            compact
            cellPadding="8px 14px"
            getRowClassName={(row) => tableRowClass(row)}
            emptyMessage={lang === 'ar' ? 'لا توجد بيانات' : 'No data'}
          />
        </section>
      )}
    </div>
  );
}
