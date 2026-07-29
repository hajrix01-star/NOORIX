import React from 'react';
import { Button, cn } from '../../ui';
import {
  amountText,
  percentText,
  displayLabel,
  getRowTone,
  isEmptyMetric,
} from './reportHelpers';
import type { GeneralProfitLossReport, PlDisplayRow, ReportDetailState } from './reportTypes';
import {
  periodAmount,
  periodPercent,
  rowIdentity,
  type ComparisonColumnPeriod,
} from './reportsComparablePeriodModel';

export type GeneralPlTableProps = {
  report: GeneralProfitLossReport;
  visibleRows: PlDisplayRow[];
  collapsedGroups: Record<string, boolean>;
  toggleGroup: (key: string) => void;
  lang: string;
  t: (k: string) => string;
  isMobile: boolean;
  selectedMonthNumber: number | null;
  monthNames: string[];
  onOpenDetail: (payload: ReportDetailState) => void;
  currentColumnPeriod?: ComparisonColumnPeriod | null;
  compareColumnPeriods?: ComparisonColumnPeriod[];
  compareRows?: Map<string, PlDisplayRow>;
};

export default function GeneralPlTable({
  report,
  visibleRows,
  lang,
  t,
  isMobile,
  selectedMonthNumber,
  monthNames,
  onOpenDetail,
  currentColumnPeriod = null,
  compareColumnPeriods = [],
  compareRows = new Map<string, PlDisplayRow>(),
}: GeneralPlTableProps) {
  const stickyEdge = lang === 'en' ? 'left' : 'right';
  const isPeriodMode = currentColumnPeriod != null;
  const visibleMonthColumns = isPeriodMode ? [] : (report?.months ?? []);
  const showAnnualTotal = !isPeriodMode;
  const monthCompareColumns = isPeriodMode ? compareColumnPeriods : [];

  return (
    <div className="nx-pl-table-scroll">
      <table
        className={cn(
          'nx-pl-table w-full table-fixed border-collapse',
          isPeriodMode && 'nx-pl-table--fit',
          plMinWidthClass(isMobile, isPeriodMode, monthCompareColumns.length),
        )}
      >
        <colgroup>
          <col className={isMobile ? 'w-[48%]' : isPeriodMode ? 'w-[300px]' : 'w-[260px]'} />
          {isPeriodMode && <col className={isMobile ? 'w-[26%]' : 'w-[170px]'} />}
          {isPeriodMode && monthCompareColumns.map((column) => (
            <col key={column.key} className={isMobile ? 'w-[26%]' : 'w-[154px]'} />
          ))}
          {!isMobile && visibleMonthColumns.map((month) => <col key={month.index} className="w-[76px]" />)}
          {showAnnualTotal && <col className={isMobile ? 'w-[27%]' : 'w-[138px]'} />}
        </colgroup>

        <thead>
          <tr>
            <th
              className={cn(
                'nx-pl-table__th nx-pl-table__th--item sticky z-[3] font-primary text-noorix-text',
                stickyEdge === 'left' ? 'left-0' : 'right-0',
              )}
            >
              {t('reportItem')}
            </th>
            {isPeriodMode && currentColumnPeriod && (
              <th className="nx-pl-table__th nx-pl-table__th--amount text-center font-primary text-noorix-text">
                {currentColumnPeriod.label}
              </th>
            )}
            {isPeriodMode && monthCompareColumns.map((column) => (
              <th
                key={column.key}
                className="nx-pl-table__th nx-pl-table__th--amount text-center font-primary text-noorix-text"
              >
                {column.label}
              </th>
            ))}
            {!isMobile &&
              visibleMonthColumns.map((month) => (
                <th
                  key={month.index}
                  className="nx-pl-table__th nx-pl-table__th--month whitespace-nowrap text-center font-primary text-noorix-text"
                >
                  {month.label}
                </th>
              ))}
            {showAnnualTotal && (
              <th className="nx-pl-table__th nx-pl-table__th--total text-center font-primary text-noorix-text">
                {t('reportAnnualTotal')}
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {visibleRows.map((row) => {
            const isGroup = row.rowType === 'group';
            const isCategory = row.rowType === 'category';
            const isSummary = row.rowType === 'summary';
            const canOpenItem = row.rowType === 'item';
            const canCollapse = isGroup || isCategory;
            const rowTone = getRowTone(row);

            return (
              <tr
                key={`${row.groupKey}-${row.itemKey || row.rowType}-${row.depth ?? 0}`}
                className={cn(
                  'report-table-row nx-pl-table__row',
                  isGroup && 'nx-pl-table__row--group',
                  isCategory && 'nx-pl-table__row--category',
                  isSummary && 'nx-pl-table__row--summary',
                )}
                style={{
                  background: rowTone.bg,
                  borderTop: rowTone.borderTop || undefined,
                }}
              >
                <td
                  className={cn(
                    'nx-pl-table__cell nx-pl-table__cell--item sticky z-[2] overflow-hidden text-ellipsis font-primary leading-snug',
                    stickyEdge === 'left' ? 'left-0' : 'right-0',
                  )}
                  style={{ background: rowTone.stickyBg }}
                >
                  {canCollapse ? (
                    <div
                      className={cn(
                        'flex w-full min-w-0 items-center gap-2 border-0 bg-transparent p-0 font-primary',
                        lang === 'en' ? 'text-left' : 'text-right',
                        isCategory ? 'font-bold' : 'font-extrabold',
                        plAmountColorClass(row, rowTone, isSummary, row.total),
                        plIndentClass(row.depth || 0, 0),
                      )}
                      title={displayLabel(row, lang)}
                    >
                      <span className="min-w-0 truncate">{displayLabel(row, lang)}</span>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={() =>
                        canOpenItem &&
                        row.groupKey &&
                        onOpenDetail({
                          month: selectedMonthNumber,
                          groupKey: row.groupKey,
                          itemKey: row.itemKey,
                          showTrend: true,
                        })
                      }
                      className={cn(
                        'flex w-full min-w-0 border-0 bg-transparent p-0 font-primary',
                        lang === 'en' ? 'text-left' : 'text-right',
                        isSummary ? 'font-extrabold' : 'font-medium',
                        canOpenItem ? 'cursor-pointer' : 'cursor-default',
                        plAmountColorClass(row, rowTone, isSummary, row.total),
                        plIndentClass(row.depth || 0, row.rowType === 'item' ? 20 : 0),
                      )}
                      title={canOpenItem ? `${displayLabel(row, lang)} - ${t('reportOpenTrend')}` : displayLabel(row, lang)}
                    >
                      {row.rowType === 'item' && <span className="w-3 shrink-0 text-sm leading-none text-noorix-muted">-</span>}
                      <span className="min-w-0 truncate">{displayLabel(row, lang)}</span>
                    </Button>
                  )}
                </td>

                {isPeriodMode && currentColumnPeriod && (
                  <td
                    className={cn(
                      'nx-pl-table__cell nx-pl-table__cell--amount text-center font-bold nx-font-numbers',
                      plAmountColorClass(row, rowTone, isSummary, periodAmount(row, currentColumnPeriod.period)),
                    )}
                  >
                    <Button
                      variant="raw"
                      type="button"
                      className="nx-pl-table__amount-btn block w-full cursor-pointer border-0 bg-transparent p-0 text-inherit"
                      onClick={() =>
                        row.groupKey &&
                        onOpenDetail({
                          month: currentColumnPeriod.period.month,
                          groupKey: row.groupKey,
                          itemKey: row.itemKey,
                          showTrend: row.rowType === 'item',
                        })
                      }
                    >
                      <div className="nx-pl-table__amount">{tableAmountText(periodAmount(row, currentColumnPeriod.period))}</div>
                      <div className="nx-pl-table__percent">
                        {tablePercentText(periodPercent(row, currentColumnPeriod.period))}
                      </div>
                    </Button>
                  </td>
                )}

                {isPeriodMode && monthCompareColumns.map((column) => {
                  const compareRow = compareRows.get(`${column.period.year}:${rowIdentity(row)}`);
                  const compareValue = compareRow ? periodAmount(compareRow, column.period) : null;
                  const comparePercent = compareRow ? periodPercent(compareRow, column.period) : null;
                  return (
                    <td
                      key={`${row.groupKey}-${column.key}`}
                      className={cn(
                        'nx-pl-table__cell nx-pl-table__cell--amount text-center font-bold nx-font-numbers',
                        compareValue == null ? 'text-noorix-muted' : plAmountColorClass(row, rowTone, isSummary, compareValue),
                      )}
                    >
                      <div className="nx-pl-table__amount">
                        {compareValue == null ? '' : tableAmountText(compareValue)}
                      </div>
                      <div className="nx-pl-table__percent">
                        {tablePercentText(comparePercent)}
                      </div>
                    </td>
                  );
                })}

                {!isPeriodMode && !isMobile &&
                  (row.months ?? []).map((value, index) => (
                    <td
                      key={`${row.groupKey}-${index}`}
                      className="nx-pl-table__cell nx-pl-table__cell--month text-center nx-font-numbers"
                    >
                      <Button
                        variant="raw"
                        type="button"
                        className={cn(
                          'nx-pl-table__amount-btn block w-full cursor-pointer border-0 bg-transparent p-0',
                          plAmountColorClass(row, rowTone, isSummary, value),
                          isSummary || isGroup ? 'font-extrabold' : isCategory ? 'font-bold' : 'font-semibold',
                        )}
                        onClick={() =>
                          row.groupKey &&
                          onOpenDetail({
                            month: index + 1,
                            groupKey: row.groupKey,
                            itemKey: row.itemKey,
                            showTrend: row.rowType === 'item',
                          })
                        }
                      >
                        <div className="nx-pl-table__amount">
                          {tableAmountText(value)}
                        </div>
                        <div className="nx-pl-table__percent">
                          {tablePercentText(row.percentOfSalesMonths?.[index])}
                        </div>
                      </Button>
                    </td>
                  ))}

                {showAnnualTotal && (
                  <td
                    className={cn(
                    'nx-pl-table__cell nx-pl-table__cell--total text-center font-extrabold nx-font-numbers',
                      plAmountColorClass(row, rowTone, isSummary, row.total),
                    )}
                  >
                    <div className="nx-pl-table__amount">
                      {tableAmountText(row.total)}
                    </div>
                    <div className="nx-pl-table__percent">
                      {tablePercentText(row.percentOfSalesYear)}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function tableAmountText(value: unknown) {
  return isEmptyMetric(value) ? '' : amountText(value);
}

function tablePercentText(value: unknown) {
  return isEmptyMetric(value) ? '' : percentText(value);
}

function plMinWidthClass(isMobile: boolean, isMonthlyMode: boolean, compareColumnCount: number) {
  if (isMobile) return 'min-w-full';
  if (!isMonthlyMode) return 'min-w-[1320px]';
  if (compareColumnCount >= 4) return 'min-w-[1080px]';
  if (compareColumnCount >= 2) return 'min-w-[820px]';
  if (compareColumnCount === 1) return 'min-w-[650px]';
  return 'min-w-[500px]';
}

function plIndentClass(depth: number, extra: number) {
  const px = Math.min(Math.max(depth * 22 + extra, 0), 108);
  if (px <= 0) return 'nx-pl-indent-0';
  if (px <= 20) return 'nx-pl-indent-20';
  if (px <= 22) return 'nx-pl-indent-22';
  if (px <= 42) return 'nx-pl-indent-42';
  if (px <= 44) return 'nx-pl-indent-44';
  if (px <= 64) return 'nx-pl-indent-64';
  if (px <= 66) return 'nx-pl-indent-66';
  if (px <= 86) return 'nx-pl-indent-86';
  if (px <= 88) return 'nx-pl-indent-88';
  return 'nx-pl-indent-108';
}

function plAmountColorClass(
  _row: PlDisplayRow,
  _rowTone: ReturnType<typeof getRowTone>,
  _isSummary: boolean,
  _value: unknown,
) {
  return 'text-noorix-text';
}
