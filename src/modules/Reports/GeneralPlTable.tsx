import React from 'react';
import { Button, cn } from '../../ui';
import {
  amountText,
  percentText,
  displayLabel,
  getContextAmount,
  getContextPercent,
  getRowTone,
} from './reportHelpers';
import type { GeneralProfitLossReport, PlDisplayRow, ReportDetailState } from './reportTypes';

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
};

export default function GeneralPlTable({
  report,
  visibleRows,
  collapsedGroups,
  toggleGroup,
  lang,
  t,
  isMobile,
  selectedMonthNumber,
  monthNames,
  onOpenDetail,
}: GeneralPlTableProps) {
  const stickyEdge = lang === 'en' ? 'left' : 'right';
  const isMonthlyMode = selectedMonthNumber != null;
  const visibleMonthColumns = isMonthlyMode ? [] : (report?.months ?? []);

  return (
    <div className="nx-pl-table-scroll">
      <table className={cn('nx-pl-table w-full table-fixed border-collapse', plMinWidthClass(isMobile, isMonthlyMode))}>
        <colgroup>
          <col className={isMobile ? 'w-[46%]' : isMonthlyMode ? 'w-[340px]' : 'w-[260px]'} />
          {isMonthlyMode && <col className={isMobile ? 'w-[27%]' : 'w-[210px]'} />}
          {!isMobile && visibleMonthColumns.map((month) => <col key={month.index} className="w-[76px]" />)}
          <col className={isMobile ? 'w-[27%]' : 'w-[138px]'} />
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
            {isMonthlyMode && (
              <th className="nx-pl-table__th nx-pl-table__th--amount text-center font-primary text-noorix-text">
                {monthNames[selectedMonthNumber - 1]}
              </th>
            )}
            {!isMobile &&
              visibleMonthColumns.map((month) => (
                <th
                  key={month.index}
                  className="nx-pl-table__th nx-pl-table__th--month whitespace-nowrap text-center font-primary text-noorix-text"
                >
                  {month.label}
                </th>
              ))}
            <th className="nx-pl-table__th nx-pl-table__th--total text-end font-primary text-noorix-text">
              {t('reportAnnualTotal')}
            </th>
          </tr>
        </thead>

        <tbody>
          {visibleRows.map((row) => {
            const isGroup = row.rowType === 'group';
            const isCategory = row.rowType === 'category';
            const isSummary = row.rowType === 'summary';
            const canOpenItem = row.rowType === 'item';
            const collapseKey = isGroup ? row.groupKey : row.collapseKey;
            const isCollapsed = !!collapseKey && !!collapsedGroups[String(collapseKey)];
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
                    <Button
                      type="button"
                      onClick={() => toggleGroup(String(collapseKey))}
                      className={cn(
                        'flex w-full min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 font-primary',
                        lang === 'en' ? 'text-left' : 'text-right',
                        isCategory ? 'font-bold' : 'font-extrabold',
                        plAmountColorClass(row, rowTone, isSummary, row.total),
                        plIndentClass(row.depth || 0, 0),
                      )}
                      title={`${displayLabel(row, lang)} - ${isCollapsed ? t('expand') : t('collapse')}`}
                    >
                      <span className="nx-pl-table__toggle" aria-hidden>
                        {isCollapsed ? '+' : '-'}
                      </span>
                      <span className="min-w-0 truncate">{displayLabel(row, lang)}</span>
                    </Button>
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

                {isMonthlyMode && (
                  <td
                    className={cn(
                      'nx-pl-table__cell nx-pl-table__cell--amount text-center font-bold nx-font-numbers',
                      plAmountColorClass(row, rowTone, isSummary, getContextAmount(row, selectedMonthNumber)),
                    )}
                  >
                    <Button
                      variant="raw"
                      type="button"
                      className="nx-pl-table__amount-btn block w-full cursor-pointer border-0 bg-transparent p-0 text-inherit"
                      onClick={() =>
                        row.groupKey &&
                        onOpenDetail({
                          month: selectedMonthNumber,
                          groupKey: row.groupKey,
                          itemKey: row.itemKey,
                          showTrend: row.rowType === 'item',
                        })
                      }
                    >
                      <div className="nx-pl-table__amount">{amountText(getContextAmount(row, selectedMonthNumber))}</div>
                      <div className="nx-pl-table__percent">
                        {percentText(getContextPercent(row, selectedMonthNumber))}
                      </div>
                    </Button>
                  </td>
                )}

                {!isMobile &&
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
                        <div className={cn('nx-pl-table__amount', isGroup || isSummary ? 'text-[13px]' : 'text-xs')}>
                          {amountText(value)}
                        </div>
                        <div className="nx-pl-table__percent">
                          {percentText(row.percentOfSalesMonths?.[index])}
                        </div>
                      </Button>
                    </td>
                  ))}

                <td
                  className={cn(
                    'nx-pl-table__cell nx-pl-table__cell--total text-end font-extrabold nx-font-numbers',
                    plAmountColorClass(row, rowTone, isSummary, row.total),
                  )}
                >
                  <div className={cn('nx-pl-table__amount', isGroup || isSummary ? 'text-sm' : 'text-[13px]')}>
                    {amountText(row.total)}
                  </div>
                  <div className="nx-pl-table__percent">
                    {percentText(row.percentOfSalesYear)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function plMinWidthClass(isMobile: boolean, isMonthlyMode: boolean) {
  if (isMobile) return 'min-w-full';
  return isMonthlyMode ? 'min-w-[760px]' : 'min-w-[1320px]';
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
  row: PlDisplayRow,
  rowTone: ReturnType<typeof getRowTone>,
  isSummary: boolean,
  value: unknown,
) {
  if (isSummary) {
    return Number(value || 0) >= 0 ? 'text-noorix-blue' : 'text-noorix-red';
  }
  if (Number(value || 0) < 0) return 'text-noorix-red';
  if (row.groupKey === 'purchases') return 'text-noorix-red';
  if (row.groupKey === 'expenses') return 'text-noorix-amber';
  if (rowTone?.accent === 'var(--noorix-text)') return 'text-noorix-text';
  return 'text-noorix-blue';
}
