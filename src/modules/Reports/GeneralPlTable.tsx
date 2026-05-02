/**
 * جدول التقرير العام (ربح وخسارة) — أنماط عبر فئات Tailwind وتصميم Noorix.
 */
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
  const minW = isMobile ? (selectedMonthNumber ? 320 : 240) : selectedMonthNumber ? 1120 : 1060;

  return (
    <div className="overflow-x-auto">
      <table
        className={cn('w-full border-collapse', !isMobile && 'table-fixed')}
        style={{ minWidth: minW }}
      >
        <colgroup>
          <col className={isMobile ? 'w-[130px]' : 'w-[220px]'} />
          {selectedMonthNumber != null && <col className={isMobile ? '' : 'w-[76px]'} />}
          {!isMobile && (report?.months ?? []).map((m: any) => <col key={m.index} className="w-[66px]" />)}
          <col className="w-[100px]" />
        </colgroup>
        <thead>
          <tr>
            <th
              className={cn(
                'border-b-2 border-noorix-border bg-noorix-bg-surface z-[2] font-primary text-noorix-text font-bold',
                isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-1.5 text-[13px]',
                'sticky',
                stickyEdge === 'left' ? 'left-0' : 'right-0',
              )}
            >
              {t('reportItem')}
            </th>
            {selectedMonthNumber != null && (
              <th
                className="border-b-2 border-noorix-border bg-[var(--noorix-blue-6)] px-1.5 py-1.5 text-center text-[13px] font-bold font-primary text-noorix-text"
              >
                {monthNames[selectedMonthNumber - 1]}
              </th>
            )}
            {!isMobile &&
              (report?.months ?? []).map((month: any) => (
                <th
                  key={month.index}
                  className={cn(
                    'whitespace-nowrap border-b-2 border-noorix-border px-1 py-1 text-center text-xs font-semibold font-primary text-noorix-text',
                    selectedMonthNumber === month.index && 'bg-[var(--noorix-blue-10)]',
                  )}
                >
                  {month.label}
                </th>
              ))}
            <th
              className={cn(
                'border-b-2 border-noorix-border bg-noorix-table-header-bg px-3 py-1.5 text-end text-[13px] font-extrabold font-primary text-noorix-text',
              )}
              style={{ borderInlineStart: '2px solid var(--noorix-navy-12)' }}
            >
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
            const rowPaddingV = isGroup
              ? isMobile
                ? 'py-1.5'
                : 'py-1.5'
              : isSummary
                ? isMobile
                  ? 'py-1'
                  : 'py-1.5'
                : isCategory
                  ? isMobile
                    ? 'py-1'
                    : 'py-1.5'
                  : isMobile
                    ? 'py-0.5'
                    : 'py-1';

            return (
              <tr
                key={`${row.groupKey}-${row.itemKey || row.rowType}-${row.depth ?? 0}`}
                className="report-table-row"
                style={{
                  background: rowTone.bg,
                  borderTop: rowTone.borderTop || undefined,
                }}
              >
                <td
                  className={cn(
                    'border-b border-noorix-border font-primary leading-snug',
                    'sticky z-[1] max-w-[280px] min-w-[130px] overflow-hidden text-ellipsis',
                    stickyEdge === 'left' ? 'left-0' : 'right-0',
                    isMobile ? (isGroup ? 'text-[13px]' : 'text-xs') : isGroup ? 'text-sm' : isCategory ? 'text-[13px]' : isSummary ? 'text-sm' : 'text-[13px]',
                    isMobile ? 'px-2' : 'px-3',
                    rowPaddingV,
                  )}
                  style={{ background: rowTone.stickyBg }}
                >
                  {canCollapse ? (
                    <Button
                      type="button"
                      onClick={() => toggleGroup(String(collapseKey))}
                      className={cn(
                        'flex w-full min-w-0 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-primary',
                        lang === 'en' ? 'text-left' : 'text-right',
                        isCategory ? 'font-bold' : 'font-extrabold',
                        isMobile ? (isGroup ? 'text-[13px]' : 'text-xs') : isGroup ? 'text-sm' : 'text-[13px]',
                      )}
                      style={{ color: rowTone.accent, paddingInlineStart: indent }}
                      title={`${displayLabel(row, lang)} — ${isCollapsed ? t('expand') : t('collapse')}`}
                    >
                      <span className="w-3.5 shrink-0 text-center text-[11px] opacity-75">{isCollapsed ? '▶' : '▼'}</span>
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
                        isMobile ? 'text-xs' : isSummary ? 'text-sm' : 'text-[13px]',
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
                      title={canOpenItem ? `${displayLabel(row, lang)} — ${t('reportOpenTrend')}` : displayLabel(row, lang)}
                    >
                      {row.rowType === 'item' && (
                        <span className="w-3 shrink-0 text-sm leading-none text-noorix-muted">–</span>
                      )}
                      <span className="min-w-0 truncate">{displayLabel(row, lang)}</span>
                    </Button>
                  )}
                </td>

                {selectedMonthNumber != null && (
                  <td
                    className={cn(
                      'border-b border-noorix-border px-2 text-center font-bold nx-font-numbers',
                      rowPaddingV,
                    )}
                    style={{
                      background:
                        row.groupKey === 'purchases'
                          ? 'var(--noorix-red-7)'
                          : row.groupKey === 'expenses'
                            ? 'var(--noorix-amber-7)'
                            : 'var(--noorix-blue-4)',
                      color: isSummary
                        ? Number(getContextAmount(row, selectedMonthNumber) || 0) >= 0
                          ? 'var(--noorix-accent-blue)'
                          : 'var(--noorix-accent-red)'
                        : row.groupKey === 'purchases' || row.groupKey === 'expenses'
                          ? rowTone.accent
                          : 'inherit',
                    }}
                  >
                    <button
                      type="button"
                      className="block w-full cursor-pointer border-0 bg-transparent p-0 text-inherit"
                      onClick={() =>
                        onOpenDetail({
                          month: selectedMonthNumber,
                          groupKey: row.groupKey,
                          itemKey: row.itemKey,
                          showTrend: row.rowType === 'item',
                        })
                      }
                    >
                      <div className="text-[13px] leading-tight">{amountText(getContextAmount(row, selectedMonthNumber))}</div>
                      <div className="mt-px text-[11px] leading-tight" style={{ color: PERCENT_COLOR }}>
                        {percentText(getContextPercent(row, selectedMonthNumber))}
                      </div>
                    </button>
                  </td>
                )}

                {!isMobile &&
                  (row.months ?? []).map((value: any, index: number) => (
                    <td
                      key={`${row.groupKey}-${index}`}
                      className={cn(
                        'border-b border-noorix-border px-1 text-center nx-font-numbers',
                        rowPaddingV,
                        selectedMonthNumber === index + 1 && 'bg-[var(--noorix-blue-6)]',
                      )}
                    >
                      <button
                        type="button"
                        className="block w-full cursor-pointer border-0 bg-transparent p-0"
                        style={{
                          color: isSummary
                            ? Number(value || 0) >= 0
                              ? 'var(--noorix-accent-blue)'
                              : 'var(--noorix-accent-red)'
                            : Number(value || 0) < 0
                              ? 'var(--noorix-accent-red)'
                              : row.groupKey === 'purchases' || row.groupKey === 'expenses'
                                ? rowTone.accent
                                : 'var(--noorix-text)',
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
                        <div className={cn('leading-tight', isGroup || isSummary ? 'text-[13px]' : 'text-xs')}>
                          {amountText(value)}
                        </div>
                        <div className="mt-px text-[11px] leading-tight" style={{ color: PERCENT_COLOR }}>
                          {percentText(row.percentOfSalesMonths?.[index])}
                        </div>
                      </button>
                    </td>
                  ))}

                <td
                  className={cn(
                    'border-b border-noorix-border bg-noorix-table-header-bg px-3 text-end font-extrabold nx-font-numbers',
                    rowPaddingV,
                  )}
                  style={{
                    borderInlineStart: '2px solid var(--noorix-navy-12)',
                    color: isSummary
                      ? Number(row.total || 0) >= 0
                        ? 'var(--noorix-accent-blue)'
                        : 'var(--noorix-accent-red)'
                      : row.groupKey === 'purchases' || row.groupKey === 'expenses'
                        ? rowTone.accent
                        : 'inherit',
                  }}
                >
                  <div className={cn('leading-tight', isGroup || isSummary ? 'text-sm' : 'text-[13px]')}>
                    {amountText(row.total)}
                  </div>
                  <div className="mt-px text-[11px] leading-tight" style={{ color: PERCENT_COLOR }}>
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
