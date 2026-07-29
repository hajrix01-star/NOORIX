import React from 'react';
import { Button } from '../../ui';
import type { SimpleTableColumn } from '../../ui';
import { amountText, percentText } from './reportHelpers';
import { displayV2RowLabel, groupToneClass } from './generalReportV2Model';
import {
  numericAmount,
  periodAmount,
  rowIdentity,
  type ComparablePeriod,
} from './reportsComparablePeriodModel';
import type { PlDisplayRow } from './reportTypes';

type CompareColumnPeriod = {
  key: string;
  label: string;
  period: ComparablePeriod;
};

type BuildGeneralReportV2TableModelArgs = {
  lang: string;
  year: number;
  monthNames: string[];
  currentPeriod: ComparablePeriod;
  comparePeriod: ComparablePeriod;
  compareEnabled: boolean;
  compareColumnPeriods: CompareColumnPeriod[];
  compareRows: Map<string, PlDisplayRow>;
  collapsedGroups: Record<string, boolean>;
  selectedMonthNumber: number | null;
  currentPeriodLabel: string;
  annualTotalLabel: string;
  toggleGroup: (key: string) => void;
  openDetail: (row: PlDisplayRow, month: number | null, showTrend: boolean) => void;
};

export function formatGeneralReportV2Change(current: number, previous: number, lang: string) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return '-';
  if (previous === 0) {
    if (current === 0) return '-';
    return current > 0 ? (lang === 'ar' ? 'جديد' : 'New') : (lang === 'ar' ? 'بدون أساس' : 'No base');
  }
  const value = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function generalReportV2TableRowClass(row: PlDisplayRow) {
  const rowTone = groupToneClass(row);
  if (row.rowType === 'summary') return rowTone ? 'bg-slate-300/80 font-black' : 'bg-slate-200/90 font-black';
  if (row.rowType === 'groupTotal') return 'bg-slate-200/90 font-black';
  return 'bg-white';
}

function generalReportV2ValueClass(_value: number, row: PlDisplayRow) {
  if (row.rowType === 'summary' || row.rowType === 'groupTotal') return 'text-slate-700';
  return 'text-slate-700';
}

export function buildGeneralReportV2TableModel({
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
  currentPeriodLabel,
  annualTotalLabel,
  toggleGroup,
  openDetail,
}: BuildGeneralReportV2TableModelArgs) {
  const isYearTable = currentPeriod.mode === 'year';
  const reportMonthCount = 12;
  const labelColumnMinWidth = isYearTable ? 240 : compareEnabled ? 300 : 260;
  const labelColumn: SimpleTableColumn<PlDisplayRow> = {
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
            {canCollapse ? (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-[11px]">
                {collapsedGroups[String(collapseKey)] ? '+' : '-'}
              </span>
            ) : null}
            {!canCollapse && depth === 1 ? <span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> : null}
            {!canCollapse && depth >= 2 ? <span className="h-px w-5 bg-slate-300" /> : null}
            <span>{displayV2RowLabel(row, lang)}</span>
          </Button>
        </div>
      );
    },
  };

  const comparisonColumns: SimpleTableColumn<PlDisplayRow>[] = [
    labelColumn,
    {
      key: 'current',
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-white">{year}</span>
          <span className="max-w-[140px] truncate text-[11px] font-black text-white/75">{currentPeriodLabel}</span>
        </div>
      ),
      numeric: true,
      width: 160,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const current = periodAmount(row, currentPeriod);
        return (
          <span className={`inline-block min-w-[116px] text-end font-black ${generalReportV2ValueClass(current, row)}`} dir="ltr">
            {amountText(current)}
          </span>
        );
      },
    },
  ];

  if (compareEnabled) {
    for (const compareColumn of compareColumnPeriods) {
      comparisonColumns.push({
        key: compareColumn.key,
        label: (
          <div className="grid gap-0.5 text-center">
            <span className="font-black text-white">{comparePeriod.year}</span>
            <span className="max-w-[140px] truncate text-[11px] font-black text-white/75">{compareColumn.label}</span>
          </div>
        ),
        numeric: true,
        width: 144,
        align: 'end',
        headerClassName: 'text-center',
        cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
        render: (_value, row) => {
          const compareRow = compareRows.get(rowIdentity(row));
          const previous = compareRow ? periodAmount(compareRow, compareColumn.period) : 0;
          return (
            <span className={`inline-block min-w-[116px] text-end font-black ${generalReportV2ValueClass(previous, row)}`} dir="ltr">
              {compareRow ? amountText(previous) : '-'}
            </span>
          );
        },
      });
    }
    comparisonColumns.push({
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
        const compareRow = compareRows.get(rowIdentity(row));
        const current = periodAmount(row, currentPeriod);
        const previous = compareRow
          ? compareColumnPeriods.reduce((total, item) => total + periodAmount(compareRow, item.period), 0)
          : 0;
        return (
          <span className="inline-block min-w-[78px] text-end font-black text-slate-500" dir="ltr">
            {compareRow ? formatGeneralReportV2Change(current, previous, lang) : '-'}
          </span>
        );
      },
    });
  }

  const yearlyColumns: SimpleTableColumn<PlDisplayRow>[] = [
    labelColumn,
    ...monthNames.map((label, index): SimpleTableColumn<PlDisplayRow> => {
      const monthIndex = index + 1;
      return {
        key: `m${monthIndex}`,
        label: (
          <div className="grid gap-0.5 text-center">
            <span className="font-black text-white">{label}</span>
            <span className="text-[11px] font-black text-white/75">{year}</span>
          </div>
        ),
        numeric: true,
        width: 86,
        align: 'end',
        headerClassName: 'text-center',
        cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
        render: (_value, row) => {
          const value = numericAmount(row.months?.[monthIndex - 1]);
          return (
            <Button
              variant="raw"
              type="button"
              className={`inline-block min-w-[64px] p-0 text-end font-black ${generalReportV2ValueClass(value, row)}`}
              onClick={() => openDetail(row, monthIndex, (row.originalRowType || row.rowType) === 'item')}
              dir="ltr"
            >
              {amountText(value)}
            </Button>
          );
        },
      };
    }),
    {
      key: 'total',
      label: (
        <div className="grid gap-0.5 text-center">
          <span className="font-black text-white">{annualTotalLabel}</span>
          <span className="text-[11px] font-black text-white/75">{year}</span>
        </div>
      ),
      numeric: true,
      width: 104,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => {
        const value = numericAmount(row.total);
        return (
          <span className={`inline-block min-w-[78px] text-end font-black ${generalReportV2ValueClass(value, row)}`} dir="ltr">
            {amountText(value)}
          </span>
        );
      },
    },
    {
      key: 'percent',
      label: '%',
      numeric: true,
      width: 72,
      align: 'end',
      headerClassName: 'text-center',
      cellClassName: 'text-end font-[var(--noorix-font-numbers)] tabular-nums',
      render: (_value, row) => (
        <span className="inline-block min-w-[52px] text-end font-black text-slate-500" dir="ltr">
          {percentText(row.percentOfSalesYear)}
        </span>
      ),
    },
  ];

  const tableMinWidth = isYearTable
    ? Math.max(1360, labelColumnMinWidth + reportMonthCount * 86 + 104 + 72)
    : compareEnabled
      ? labelColumnMinWidth + 160 + Math.max(1, compareColumnPeriods.length) * 144 + 120
      : Math.max(480, labelColumnMinWidth + 160);

  return {
    activeColumns: isYearTable ? yearlyColumns : comparisonColumns,
    tableMinWidth,
  };
}
