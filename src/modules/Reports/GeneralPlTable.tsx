import React from 'react';
import { Button, cn } from '../../ui';
import {
  PERCENT_COLOR,
  amountText,
  percentText,
  displayLabel,
  getContextAmount,
  getContextPercent,
  getRowTone,
} from './reportHelpers';

export type GeneralPlTableProps = {
  report: any;
  visibleRows: any[];
  collapsedGroups: Record<string, boolean>;
  toggleGroup: (key: string) => void;
  lang: string;
  t: (k: string) => string;
  isMobile: boolean;
  selectedMonthNumber: number | null;
  monthNames: string[];
  onOpenDetail: (payload: {
    month: number | null;
    groupKey: string;
    itemKey: string | null;
    showTrend?: boolean;
  }) => void;
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
  const minWidth: number | string = isMobile ? '100%' : isMonthlyMode ? 760 : 1320;

  return (
    <div className="nx-pl-table-scroll">
      <table className="nx-pl-table w-full table-fixed border-collapse" style={{ minWidth }}>
        <colgroup>
          <col className={isMobile ? 'w-[46%]' : isMonthlyMode ? 'w-[340px]' : 'w-[260px]'} />
          {isMonthlyMode && <col className={isMobile ? 'w-[27%]' : 'w-[210px]'} />}
          {!isMobile && visibleMonthColumns.map((month: any) => <col key={month.index} className="w-[76px]" />)}
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
              visibleMonthColumns.map((month: any) => (
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
          {visibleRows.map((row: any) => {
            const isGroup = row.rowType === 'group';
            const isCategory = row.rowType === 'category';
            const isSummary = row.rowType === 'summary';
            const canOpenItem = row.rowType === 'item';
            const collapseKey = isGroup ? row.groupKey : row.collapseKey;
            const isCollapsed = !!collapseKey && !!collapsedGroups[String(collapseKey)];
            const canCollapse = isGroup || isCategory;
            const indent = (row.depth || 0) * 22;
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
                      )}
                      style={{ color: rowTone.accent, paddingInlineStart: indent }}
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
                      )}
                      style={{
                        color: isSummary
                          ? rowTone.accent
                          : row.groupKey === 'purchases' || row.groupKey === 'expenses'
                            ? rowTone.accent
                            : 'var(--noorix-text)',
                        paddingInlineStart: indent + (row.rowType === 'item' ? 20 : 0),
                      }}
                      title={canOpenItem ? `${displayLabel(row, lang)} - ${t('reportOpenTrend')}` : displayLabel(row, lang)}
                    >
                      {row.rowType === 'item' && <span className="w-3 shrink-0 text-sm leading-none text-noorix-muted">-</span>}
                      <span className="min-w-0 truncate">{displayLabel(row, lang)}</span>
                    </Button>
                  )}
                </td>

                {isMonthlyMode && (
                  <td
                    className="nx-pl-table__cell nx-pl-table__cell--amount text-center font-bold nx-font-numbers"
                    style={{
                      color: resolveAmountColor(row, rowTone, isSummary, getContextAmount(row, selectedMonthNumber)),
                    }}
                  >
                    <Button
                      variant="raw"
                      type="button"
                      className="nx-pl-table__amount-btn block w-full cursor-pointer border-0 bg-transparent p-0 text-inherit"
                      onClick={() =>
                        onOpenDetail({
                          month: selectedMonthNumber,
                          groupKey: row.groupKey,
                          itemKey: row.itemKey,
                          showTrend: row.rowType === 'item',
                        })
                      }
                    >
                      <div className="nx-pl-table__amount">{amountText(getContextAmount(row, selectedMonthNumber))}</div>
                      <div className="nx-pl-table__percent" style={{ color: PERCENT_COLOR }}>
                        {percentText(getContextPercent(row, selectedMonthNumber))}
                      </div>
                    </Button>
                  </td>
                )}

                {!isMobile &&
                  (row.months ?? []).map((value: any, index: number) => (
                    <td
                      key={`${row.groupKey}-${index}`}
                      className="nx-pl-table__cell nx-pl-table__cell--month text-center nx-font-numbers"
                    >
                      <Button
                        variant="raw"
                        type="button"
                        className="nx-pl-table__amount-btn block w-full cursor-pointer border-0 bg-transparent p-0"
                        style={{
                          color: resolveAmountColor(row, rowTone, isSummary, value),
                          fontWeight: isSummary || isGroup ? 800 : isCategory ? 700 : 600,
                        }}
                        onClick={() =>
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
                        <div className="nx-pl-table__percent" style={{ color: PERCENT_COLOR }}>
                          {percentText(row.percentOfSalesMonths?.[index])}
                        </div>
                      </Button>
                    </td>
                  ))}

                <td
                  className="nx-pl-table__cell nx-pl-table__cell--total text-end font-extrabold nx-font-numbers"
                  style={{
                    color: resolveAmountColor(row, rowTone, isSummary, row.total),
                  }}
                >
                  <div className={cn('nx-pl-table__amount', isGroup || isSummary ? 'text-sm' : 'text-[13px]')}>
                    {amountText(row.total)}
                  </div>
                  <div className="nx-pl-table__percent" style={{ color: PERCENT_COLOR }}>
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

function resolveAmountColor(row: any, rowTone: any, isSummary: boolean, value: unknown) {
  if (isSummary) {
    return Number(value || 0) >= 0 ? 'var(--noorix-accent-blue)' : 'var(--noorix-accent-red)';
  }
  if (Number(value || 0) < 0) return 'var(--noorix-accent-red)';
  if (row.groupKey === 'purchases' || row.groupKey === 'expenses') return rowTone.accent;
  return 'var(--noorix-text)';
}
