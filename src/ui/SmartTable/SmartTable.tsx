/**
 * SmartTable — مكون الجداول المركزي لنظام نوركس
 * Pagination | Global Search | Sorting | Empty State | Loading | Mobile Cards | Column Resize
 */
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useIsNarrow768 } from '../../hooks/useMediaQuery';
import { useUiDir } from '../../hooks/useUiDir';
import Input from '../Input';
import { cn } from '../cn';
import type { SmartTableProps as SmartTablePropsBase } from './types';
import { columnLabel, getAlign } from './columnUtils';
import { buildFooterCells } from './buildFooterCells';
import { getColumnKindClass, normalizeSmartColumn } from './columnPresets';
import { useSmartTableEngine } from './tableEngine';
import SmartTablePagination from './SmartTablePagination';
import SmartTableColumnVisibility, { placeColVisPanel } from './SmartTableColumnVisibility';

const DEFAULT_INNER_PADDING = 8;
const DEFAULT_ROW_NUMBER_WIDTH = 40;

type SmartTableCssVars = React.CSSProperties & Record<`--${string}`, string | number | undefined>;

function normalizeRowNumberWidth(width: SmartTablePropsBase['rowNumberWidth']): number | string {
  if (width == null || width === '') return DEFAULT_ROW_NUMBER_WIDTH;
  if (typeof width === 'string' && width.trim().endsWith('%')) return DEFAULT_ROW_NUMBER_WIDTH;
  return width;
}

function cssLength(value: number | string | undefined): string | undefined {
  if (value == null || value === '') return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

export { placeColVisPanel };

// ── SmartTable ───────────────────────────────────────────────
const SmartTable = memo(function SmartTable(props: SmartTablePropsBase) {
  const {
    columns = [],
    data = [],
    total = 0,
    page = 1,
    pageSize = 50,
    onPageChange,
    isLoading = false,
    isError = false,
    errorMessage = 'فشل تحميل البيانات',
    footerCells = null,
    /**
     * بديل footerCells المدرك لإخفاء الأعمدة.
     * مصفوفة شرائح: [{ keys: string[], content?: ReactNode, className?: string }]
     * keys = مفاتيح الأعمدة التي تمتد عليها الخلية (بالترتيب وبدون فجوات).
     */
    footerRow = null,
    title,
    badge,
    searchValue,
    onSearchChange,
    /** عند false يبقى البحث تحت سيطرة الشاشة (حقل خارجي) مع الإبقاء على عنوان/شارة الجدول */
    showSearchInHeader = true,
    emptyMessage,
    sortKey,
    sortDir = 'desc',
    onSort,
    children,
    footer,
    tableMinWidth = 0,
    compact = true,
    showRowNumbers = false,
    innerPadding = DEFAULT_INNER_PADDING,
    tableLayout,
    rowNumberWidth,
    getRowClassName,
    getRowStyle,
    isRowExpanded,
    renderExpandedRow,
    renderMobileCard,
    /** صفوف متناوبة الخلفية في عرض بطاقات الجوال — افتراضي مفعّل؛ عطّل بـ false */
    stripeMobileCards = true,
    renderCompactRow,
    stickyActionColumn = true,
    /** معرف فريد للجدول — لما يُمرَّر يُفعّل السحب لتغيير عرض الأعمدة + الحفظ في localStorage */
    tableId,
    frameClassName,
    keyExtractor,
  } = props;
  const { t } = useTranslation();
  const dir = useUiDir();
  const normalizedColumns = useMemo(() => columns.map((col: any) => normalizeSmartColumn(col)), [columns]);

  // ── Column Resize ──────────────────────────────────────────────
  const resizingRef = useRef<any>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (!tableId) return {};
    try {
      const saved = localStorage.getItem(`nx-col-widths:${tableId}`);
      return saved ? (JSON.parse(saved) as Record<string, number>) : {};
    } catch { return {}; }
  });

  const handleResizeStart = useCallback((e: any, colKey: any, startW: any) => {
    e.preventDefault();
    e.stopPropagation();
    const dirMult = dir === 'rtl' ? -1 : 1;
    resizingRef.current = { colKey, startX: e.clientX, startW };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      if (!resizingRef.current) return;
      const delta = (ev.clientX - resizingRef.current.startX) * dirMult;
      const newW = Math.max(40, resizingRef.current.startW + delta);
      setColWidths((prev: any) => ({ ...prev, [colKey]: Math.round(newW) }));
    };

    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (tableId) {
        setColWidths((prev: any) => {
          try { localStorage.setItem(`nx-col-widths:${tableId}`, JSON.stringify(prev)); } catch { /* noop */ }
          return prev;
        });
      }
      resizingRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }, [dir, tableId]);

  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    if (!tableId) return new Set<string>();
    try {
      const saved = localStorage.getItem(`nx-col-vis:${tableId}`);
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const toggleColVis = useCallback((colKey: string) => {
    setHiddenCols((prev: Set<string>) => {
      const next = new Set<string>(prev);
      if (next.has(colKey)) next.delete(colKey); else next.add(colKey);
      if (tableId) {
        try { localStorage.setItem(`nx-col-vis:${tableId}`, JSON.stringify([...next])); } catch { /* noop */ }
      }
      return next;
    });
  }, [tableId]);

  const resetColVis = useCallback(() => {
    setHiddenCols(new Set<string>());
    if (tableId) {
      try { localStorage.removeItem(`nx-col-vis:${tableId}`); } catch { /* noop */ }
    }
  }, [tableId]);

  /** محاذاة مع @media (max-width: 768px) — تجنّب جدول عريض + فراغ أبيض على تابلت/جوال */
  const isNarrow = useIsNarrow768();

  const showCompact  = isNarrow && typeof renderCompactRow === 'function';
  const showCards    = isNarrow && !showCompact && typeof renderMobileCard === 'function';
  const visibleColumns = normalizedColumns.filter((col: any) => !hiddenCols.has(col.key));
  const tableEngine = useSmartTableEngine({
    columns: visibleColumns,
    data,
    sortKey,
    sortDir,
    page,
    pageSize,
    total,
    onSort,
    onPageChange,
  });
  const engineRows = tableEngine.rows;
  const pagination = tableEngine.pagination;
  const { safePageSize, totalPages } = pagination;
  const colCount     = visibleColumns.length;
  const effectiveCols = colCount + (showRowNumbers ? 1 : 0);
  const isWideTable  = effectiveCols > 6;
  const layout       = tableLayout ?? 'fixed';
  const minW         = tableMinWidth === 0 || tableMinWidth === ''
    ? undefined
    : (tableMinWidth != null ? tableMinWidth : (isWideTable ? 1100 : undefined));
  const cellPad      = compact ? { th: '6px 12px', td: '6px 12px' } : { th: '8px 14px', td: '8px 14px' };
  const rowNumW      = normalizeRowNumberWidth(rowNumberWidth);
  const cellFs       = compact ? 14 : 15;
  const errMsg       = errorMessage ?? t('loadDataFailed');
  const emptyMsg     = emptyMessage ?? t('noDataInPeriod');
  const frameStyle: SmartTableCssVars = { '--nx-smart-frame-padding': cssLength(innerPadding) };
  const tableStyle: SmartTableCssVars = {
    '--nx-smart-table-layout': layout,
    '--nx-smart-table-min-width': cssLength(minW),
    '--nx-smart-table-max-width': !isWideTable ? '100%' : undefined,
  };
  const rowNumberHeaderStyle: SmartTableCssVars = {
    '--nx-smart-cell-padding': cellPad.th,
    '--nx-smart-cell-font-size': cssLength(compact ? 11 : 12),
    '--nx-smart-row-number-width': cssLength(rowNumW),
  };
  const rowNumberCellStyle: SmartTableCssVars = {
    '--nx-smart-cell-padding': cellPad.td,
    '--nx-smart-cell-font-size': cssLength(cellFs),
    '--nx-smart-row-number-width': cssLength(rowNumW),
  };
  const headerCellStyle = (col: any, effectiveWidth: any, resizableCol: boolean, shrink: boolean): SmartTableCssVars => ({
    '--nx-smart-cell-padding': cellPad.th,
    '--nx-smart-cell-font-size': cssLength(compact ? 12 : 13),
    '--nx-smart-cell-position': resizableCol ? 'relative' : undefined,
    '--nx-smart-cell-width': cssLength(effectiveWidth),
    '--nx-smart-cell-min-width': cssLength(col.minWidth),
    '--nx-smart-cell-max-width': resizableCol ? undefined : cssLength(col.maxWidth),
    '--nx-smart-cell-cursor': col.sortable ? 'pointer' : 'default',
    '--nx-smart-cell-user-select': col.sortable ? 'none' : 'auto',
    '--nx-smart-cell-white-space': shrink || col.key === 'actions' ? 'nowrap' : 'normal',
    '--nx-smart-cell-overflow': resizableCol ? 'hidden' : undefined,
  });
  const bodyCellStyle = (
    col: any,
    tdEffectiveWidth: any,
    align: React.CSSProperties['textAlign'],
    family: string | undefined,
    shrink: boolean,
  ): SmartTableCssVars => ({
    '--nx-smart-cell-padding': cellPad.td,
    '--nx-smart-cell-font-size': cssLength(cellFs),
    '--nx-smart-cell-align': align,
    '--nx-smart-cell-font-family': family,
    '--nx-smart-cell-width': cssLength(tdEffectiveWidth),
    '--nx-smart-cell-min-width': cssLength(col.minWidth),
    '--nx-smart-cell-max-width': cssLength(col.maxWidth),
    '--nx-smart-cell-white-space': shrink ? 'nowrap' : undefined,
  });
  const rowStyle = (row: any, index: number): SmartTableCssVars => ({
    '--nx-smart-row-bg': index % 2 === 1 ? 'var(--noorix-bg-page)' : 'transparent',
    ...(typeof getRowStyle === 'function' ? getRowStyle(row, index) : null),
  });
  /** على الجوال مع بطاقات فقط: لا نعرض شريط إخفاء الأعمدة (يضيق المحتوى ويبدو كزر عائم) */
  const showTableHeaderRow = Boolean(
    title || badge || (onSearchChange && showSearchInHeader) || (tableId && !showCards),
  );
  const hideableCols = normalizedColumns.filter((c: any) => c.key !== 'actions');
  const rowKey = (row: any, index: number) => keyExtractor?.(row, index) ?? row.id ?? index;

  return (
    <div
      className={cn(
        'noorix-table-frame nx-smart-frame-vars min-w-0 max-w-full',
        (renderCompactRow || renderMobileCard) && 'max-md:overflow-x-hidden',
        showCards && 'noorix-table-frame--mobile-list',
        frameClassName,
      )}
      style={frameStyle}
    >
      {/* ── رأس الجدول ── */}
      {showTableHeaderRow && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap px-4 py-2.5 border-b border-noorix-border">
          <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
            {title && <span className="font-bold text-[15px] shrink-0">{title}</span>}
            {badge && <div className="flex items-center gap-2 flex-wrap min-w-0">{badge}</div>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onSearchChange && showSearchInHeader && (
              <Input
                type="search"
                value={searchValue ?? ''}
                onChange={(e: any) => onSearchChange(e.target.value)}
                placeholder={t('searchPlaceholder')}
                size="sm"
                className="noorix-table-search"
                aria-label={t('searchPlaceholder')}
              />
            )}
            {tableId && (
              <SmartTableColumnVisibility
                columns={hideableCols}
                hiddenCols={hiddenCols}
                onToggleColumn={toggleColVis}
                onResetColumns={resetColVis}
              />
            )}
          </div>
        </div>
      )}

      {/* ── خطأ ── */}
      {isError && (
        <div className="m-3 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-noorix-red">
          ⚠ {errMsg}
        </div>
      )}

      {/* ── تحميل — Skeleton ── */}
      {isLoading && (
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-6 h-6 rounded-full border-2 border-noorix-border border-t-noorix-blue nx-smart-table-loading-spinner"
            />
            <span className="text-noorix-muted text-[14px] font-medium">{t('loading')}</span>
          </div>
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((i: any) => (
              <div
                key={i}
                className="rounded-lg h-11 nx-smart-table-skeleton-line"
              />
            ))}
          </div>
        </div>
      )}

      {/* ── صفوف مضغوطة (List-Row pattern) ── */}
      {!isLoading && showCompact && (
        <div>
          {data.length === 0 ? (
            <div className="text-center text-noorix-muted text-[13px] py-6 px-4">
              {emptyMsg}
            </div>
          ) : engineRows.map(({ original: row, index: i }) => (
            <div
              key={rowKey(row, i)}
              className={cn(
                'nx-compact-row',
                i % 2 === 1 ? 'nx-compact-row--stripe' : 'nx-compact-row--base',
              )}
            >
              {renderCompactRow!(row, i)}
            </div>
          ))}
        </div>
      )}

      {/* ── بطاقات الجوال — حدود مستقلة + شريط أزرق فاتح متناوب (token: --noorix-blue-10) ── */}
      {!isLoading && showCards && (
        <div className="flex flex-col gap-2 py-2 px-2 sm:px-3 min-w-0 max-w-full box-border">
          {data.length === 0 ? (
            <div className="text-center text-noorix-muted text-[13px] py-6 px-4">
              {emptyMsg}
            </div>
          ) : engineRows.map(({ original: row, index: i }) => (
            <div
              key={rowKey(row, i)}
              className={cn(
                'nx-mobile-card-row px-4 py-3',
                stripeMobileCards
                  ? (i % 2 === 1 ? 'nx-mobile-card-row--stripe' : 'nx-mobile-card-row--base')
                  : 'nx-mobile-card-row--base',
              )}
            >
              {renderMobileCard(row, i)}
            </div>
          ))}
        </div>
      )}

      {/* ── الجدول ── */}
      {!isLoading && !showCards && !showCompact && (
        <div className="overflow-x-auto noorix-table-scroll-wrapper">
          <table
            className="noorix-table nx-smart-table-vars w-full"
            style={tableStyle}
          >
            <thead>
              <tr>
                {showRowNumbers && (
                  <th className="nx-row-number-th nx-smart-row-number-cell nx-smart-header-cell-vars" style={rowNumberHeaderStyle}>#</th>
                )}
                {visibleColumns.map((col: any) => {
                  const columnState = tableEngine.getColumnState(col.key);
                  const shrink = col.shrink === true;
                  const actionSticky = col.key === 'actions' && stickyActionColumn;
                  // Keep truncation on table cells display-safe; inner ellipsis spans can be block.
                  // only apply it in fixed layout (where width is enforced) or when col.maxWidth bounds it
                  const shouldTruncate = !col.numeric && col.key !== 'actions' && !shrink && (layout === 'fixed' || !!col.maxWidth);
                  const resizableCol = Boolean(tableId && col.key !== 'actions');
                  const effectiveWidth = colWidths[col.key] != null
                    ? colWidths[col.key]
                    : (col.width ?? (shrink ? '1%' : undefined));
                  return (
                    <th
                      key={col.key}
                      className={cn(
                        col.cellClassName,
                        getColumnKindClass(col),
                        col.key === 'actions' ? `noorix-actions-cell${actionSticky ? ` noorix-actions-sticky${compact ? ' noorix-actions-compact' : ''}` : (compact ? ' noorix-actions-compact' : '')}` : '',
                        col.numeric ? 'noorix-numeric-cell' : '',
                        shrink ? 'noorix-th-shrink' : '',
                        shouldTruncate ? 'noorix-table-cell-truncate' : '',
                      )}
                      style={headerCellStyle(col, effectiveWidth, resizableCol, shrink)}
                      data-column-kind={col.kind}
                      aria-sort={col.sortable ? columnState.ariaSort : undefined}
                      onClick={columnState.canSort ? () => tableEngine.toggleSort(col.key) : undefined}
                    >
                      {columnLabel(col)}
                      {col.sortable && (
                        <span className={cn('text-[13px] ms-1', columnState.isSorted ? 'opacity-100' : 'opacity-30')}>
                          {columnState.sortIndicator}
                        </span>
                      )}
                      {resizableCol && (
                        <div
                          className="nx-col-resize-handle"
                          onPointerDown={(e: any) => {
                            const th = e.currentTarget.parentElement;
                            handleResizeStart(e, col.key, th.offsetWidth);
                          }}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={effectiveCols}
                    className={cn(
                      'text-center text-noorix-muted',
                      compact ? 'px-4 py-6 text-[13px]' : 'p-9 text-[15px]',
                    )}
                  >
                    {emptyMsg}
                  </td>
                </tr>
              ) : engineRows.map(({ original: row, index: i }) => (
                <React.Fragment key={rowKey(row, i)}>
                <tr
                  className={`nx-smart-row-vars border-b border-noorix-border${typeof getRowClassName === 'function' && getRowClassName(row, i) ? ` ${getRowClassName(row, i)}` : ''}`}
                  style={rowStyle(row, i)}
                >
                  {showRowNumbers && (
                    <td className="nx-row-number-td nx-smart-row-number-cell nx-smart-body-cell-vars text-center font-semibold" style={rowNumberCellStyle}>
                      {(page - 1) * safePageSize + i + 1}
                    </td>
                  )}
                  {visibleColumns.map((col: any) => {
                    const value  = row[col.key];
                    const align  = getAlign(col);
                    const family = col.numeric ? 'var(--noorix-font-numbers)' : undefined;
                    const shrink = col.shrink === true;
                    const actionSticky = col.key === 'actions' && stickyActionColumn;
                    const shouldTruncate = !col.numeric && col.key !== 'actions' && !shrink && (layout === 'fixed' || !!col.maxWidth);
                    const tdEffectiveWidth = colWidths[col.key] != null ? colWidths[col.key] : col.width;
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          col.cellClassName,
                          getColumnKindClass(col),
                          col.key === 'actions' ? `noorix-actions-cell${actionSticky ? ` noorix-actions-sticky${compact ? ' noorix-actions-compact' : ''}` : (compact ? ' noorix-actions-compact' : '')}` : '',
                          col.numeric ? 'noorix-numeric-cell' : '',
                          shrink ? 'noorix-td-shrink' : '',
                          shouldTruncate ? 'noorix-table-cell-truncate' : '',
                        )}
                        style={bodyCellStyle(col, tdEffectiveWidth, align as React.CSSProperties['textAlign'], family, shrink)}
                        data-column-kind={col.kind}
                      >
                        {col.render ? col.render(value, row, i) : (value ?? '—')}
                      </td>
                    );
                  })}
                </tr>
                {typeof renderExpandedRow === 'function' && isRowExpanded?.(row, i) && (
                  <tr className="border-b border-noorix-border bg-noorix-surface">
                    <td colSpan={effectiveCols} className="p-0">
                      {renderExpandedRow(row, i)}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
            {(footerCells || footerRow) && (
              <tfoot>
                <tr>
                  {footerRow
                    ? buildFooterCells({ footerRow, columns: visibleColumns, hiddenCols: new Set<string>(), showRowNumbers, rowNumberWidth: rowNumW, cellPad })
                    : footerCells}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ── تصفح الصفحات ── */}
      {!isLoading && onPageChange && (
        <SmartTablePagination
          page={page}
          totalPages={totalPages}
          canPreviousPage={pagination.canPreviousPage}
          canNextPage={pagination.canNextPage}
          firstPage={pagination.firstPage}
          previousPage={pagination.previousPage}
          nextPage={pagination.nextPage}
          lastPage={pagination.lastPage}
          onPageChange={tableEngine.setPage}
          t={t}
        />
      )}

      {children}
      {footer}
    </div>
  );
});

export default SmartTable;
