/**
 * SmartTable — مكون الجداول المركزي لنظام نوركس
 * Pagination | Global Search | Sorting | Empty State | Loading | Mobile Cards | Column Resize
 */
import React, { memo, useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useIsNarrow768 } from '../responsive';
import { useUiDir } from '../../hooks/useUiDir';
import { cn } from '../cn';
import type { SmartTableColumn, SmartTableProps as SmartTablePropsBase, SmartTableRow } from './types';
import { compactColumnLabel } from './columnUtils';
import { buildFooterCells } from './buildFooterCells';
import { getColumnKindClass, normalizeSmartColumn } from './columnPresets';
import { cssLengthToPx, estimateAdaptiveColumnWidth } from './adaptiveColumnSizing';
import { useSmartTableEngine } from './tableEngine';
import SmartTablePagination from './SmartTablePagination';
import { placeColVisPanel } from './SmartTableColumnVisibility';
import SmartTableHeader from './SmartTableHeader';
import { SmartTableErrorState, SmartTableLoadingState } from './SmartTableStates';
import { SmartTableCompactRows, SmartTableMobileCards } from './SmartTableResponsiveRows';
import { useSmartTableColumnResize } from './useSmartTableColumnResize';
import { useSmartTableColumnVisibility } from './useSmartTableColumnVisibility';
import { readRowValue } from './smartTableCellValue';
import { SmartTableDesktopRows } from './SmartTableDesktopRows';
import {
  DEFAULT_INNER_PADDING,
  SMART_TABLE_COMPACT_PADDING,
  SMART_TABLE_RELAXED_BODY_PADDING,
  SMART_TABLE_RELAXED_HEADER_PADDING,
  buildColumnStyle,
  buildFrameStyle,
  buildHeaderCellStyle,
  buildRowNumberCellStyle,
  buildRowNumberHeaderStyle,
  buildTableStyle,
  DEFAULT_ROW_NUMBER_WIDTH,
} from './smartTableStyles';

export { placeColVisPanel };

function SmartTableInner<TRow extends SmartTableRow = SmartTableRow>(props: SmartTablePropsBase<TRow>) {
  const {
    columns = [],
    data = [],
    total = 0,
    page = 1,
    pageSize = 50,
    dataMode = 'manual',
    sortingMode,
    paginationMode,
    filteringMode,
    onPageChange,
    isLoading = false,
    isError = false,
    errorMessage,
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
    getRowClassName,
    getRowStyle,
    isRowExpanded,
    renderExpandedRow,
    mobileMode = 'auto',
    renderMobileCard,
    /** صفوف متناوبة الخلفية في عرض بطاقات الجوال — افتراضي مفعّل؛ عطّل بـ false */
    stripeMobileCards = true,
    renderCompactRow,
    stickyActionColumn = true,
    /** معرف فريد للجدول — لما يُمرَّر يُفعّل السحب لتغيير عرض الأعمدة + الحفظ في localStorage */
    tableId,
    columnSizingMode,
    adaptiveColumnSampleSize,
    frameClassName,
    keyExtractor,
  } = props;
  const { t } = useTranslation();
  const dir = useUiDir();
  const normalizedColumns = useMemo(() => columns.map((col) => normalizeSmartColumn(col)), [columns]);
  const sizingMode = columnSizingMode ?? (tableId ? 'adaptive' : 'fixed');

  const {
    colWidths,
    hasCustomColumnWidths,
    handleResizeStart,
    resetColumnWidths,
  } = useSmartTableColumnResize({ dir, tableId, mode: sizingMode });
  const {
    hiddenCols,
    visibleColumns,
    hideableCols,
    toggleColVis,
    resetColVis,
  } = useSmartTableColumnVisibility({ columns: normalizedColumns, tableId });

  /** محاذاة مع @media (max-width: 768px) — تجنّب جدول عريض + فراغ أبيض على تابلت/جوال */
  const isNarrow = useIsNarrow768();

  const allowMobileAlternateRows = mobileMode !== 'table';
  const showCompact  = allowMobileAlternateRows && isNarrow && typeof renderCompactRow === 'function';
  const showCards    = allowMobileAlternateRows && isNarrow && !showCompact && typeof renderMobileCard === 'function';
  const effectiveSortingMode = sortingMode ?? dataMode;
  const effectivePaginationMode = paginationMode ?? dataMode;
  const effectiveFilteringMode = filteringMode ?? dataMode;
  const tableEngine = useSmartTableEngine({
    columns: visibleColumns,
    data,
    sortKey,
    sortDir,
    page,
    pageSize,
    total,
    sortingMode: effectiveSortingMode,
    paginationMode: effectivePaginationMode,
    filteringMode: effectiveFilteringMode,
    searchValue,
    onSearchChange,
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
  const baseMinW     = tableMinWidth === 0 || tableMinWidth === ''
    ? undefined
    : (tableMinWidth != null ? tableMinWidth : (isWideTable ? 1100 : undefined));
  const cellPad      = compact
    ? { th: SMART_TABLE_COMPACT_PADDING, td: SMART_TABLE_COMPACT_PADDING }
    : { th: SMART_TABLE_RELAXED_HEADER_PADDING, td: SMART_TABLE_RELAXED_BODY_PADDING };
  const rowNumW      = DEFAULT_ROW_NUMBER_WIDTH;
  const cellFs       = compact ? 14 : 15;
  const errMsg       = errorMessage ?? t('loadDataFailed');
  const emptyMsg     = emptyMessage ?? t('noDataInPeriod');
  const visibleRows = useMemo(() => engineRows.map((row) => row.original), [engineRows]);
  const adaptiveWidths = useMemo(() => {
    if (sizingMode !== 'adaptive') return {};
    return visibleColumns.reduce<Record<string, number>>((acc, col) => {
      acc[col.key] = estimateAdaptiveColumnWidth({
        col,
        rows: visibleRows,
        sampleSize: adaptiveColumnSampleSize,
        label: compactColumnLabel(col),
      });
      return acc;
    }, {});
  }, [adaptiveColumnSampleSize, sizingMode, visibleColumns, visibleRows]);
  const adaptiveTableMinW = useMemo(() => {
    if (sizingMode !== 'adaptive') return baseMinW;
    const calculated = visibleColumns.reduce((sum, col) => sum + (colWidths[col.key] ?? adaptiveWidths[col.key] ?? 0), showRowNumbers ? rowNumW : 0);
    const explicitMin = cssLengthToPx(baseMinW);
    return Math.max(calculated, explicitMin ?? 0);
  }, [adaptiveWidths, baseMinW, colWidths, rowNumW, showRowNumbers, sizingMode, visibleColumns]);
  const frameStyle = buildFrameStyle(innerPadding);
  const tableStyle = buildTableStyle({ layout, minW: adaptiveTableMinW, isWideTable });
  const rowNumberHeaderStyle = buildRowNumberHeaderStyle({ cellPad, compact, rowNumW });
  const rowNumberCellStyle = buildRowNumberCellStyle({ cellPad, cellFs, rowNumW });
  const columnEffectiveWidth = (col: SmartTableColumn<TRow>): number | string | undefined => (
    colWidths[col.key] != null
      ? colWidths[col.key]
      : ((sizingMode === 'adaptive' ? adaptiveWidths[col.key] : undefined)
        ?? (col.width ?? (col.shrink === true ? '1%' : undefined)))
  );
  /** على الجوال مع بطاقات فقط: لا نعرض شريط إخفاء الأعمدة (يضيق المحتوى ويبدو كزر عائم) */
  const showTableHeaderRow = Boolean(
    title || badge || ((onSearchChange || effectiveFilteringMode === 'client') && showSearchInHeader) || (tableId && !showCards),
  );
  const rowKey = (row: TRow, index: number) => {
    const id = readRowValue(row, 'id');
    return keyExtractor?.(row, index) ?? (typeof id === 'string' || typeof id === 'number' ? id : index);
  };

  return (
    <div
      className={cn(
        'noorix-table-frame nx-smart-frame-vars min-w-0 max-w-full',
        allowMobileAlternateRows && (renderCompactRow || renderMobileCard) && 'max-md:overflow-x-hidden',
        showCards && 'noorix-table-frame--mobile-list',
        frameClassName,
      )}
      style={frameStyle}
    >
      {/* ── رأس الجدول ── */}
      {showTableHeaderRow && (
        <SmartTableHeader
          title={title}
          badge={badge}
          searchValue={tableEngine.search.value}
          onSearchChange={onSearchChange || (effectiveFilteringMode === 'client' ? tableEngine.search.setValue : undefined)}
          showSearchInHeader={showSearchInHeader}
          tableId={tableId}
          showColumnVisibility={!showCards}
          hideableCols={hideableCols}
          hiddenCols={hiddenCols}
          hasCustomColumnWidths={hasCustomColumnWidths}
          onToggleColumn={toggleColVis}
          onResetColumns={resetColVis}
          onResetColumnWidths={resetColumnWidths}
          t={t}
        />
      )}

      {/* ── خطأ ── */}
      {isError && (
        <SmartTableErrorState message={errMsg} />
      )}

      {/* ── تحميل — Skeleton ── */}
      {isLoading && (
        <SmartTableLoadingState loadingLabel={t('loading')} />
      )}

      {/* ── صفوف مضغوطة (List-Row pattern) ── */}
      {!isLoading && showCompact && (
        <SmartTableCompactRows
          rows={engineRows}
          dataLength={engineRows.length}
          emptyMsg={emptyMsg}
          rowKey={rowKey}
          renderCompactRow={renderCompactRow!}
        />
      )}

      {/* ── بطاقات الجوال — حدود مستقلة + شريط أزرق فاتح متناوب (token: --noorix-blue-10) ── */}
      {!isLoading && showCards && (
        <SmartTableMobileCards
          rows={engineRows}
          dataLength={engineRows.length}
          emptyMsg={emptyMsg}
          rowKey={rowKey}
          renderMobileCard={renderMobileCard}
          stripeMobileCards={stripeMobileCards}
        />
      )}

      {/* ── الجدول ── */}
      {!isLoading && !showCards && !showCompact && (
        <div className="overflow-x-auto noorix-table-scroll-wrapper">
          <table
            className="noorix-table nx-smart-table-vars w-full"
            style={tableStyle}
          >
            <colgroup>
              {showRowNumbers && (
                <col style={buildColumnStyle({ width: rowNumW, minWidth: rowNumW, maxWidth: rowNumW })} />
              )}
              {visibleColumns.map((col) => {
                const colWidth = columnEffectiveWidth(col);
                return (
                  <col
                    key={col.key}
                    data-column-kind={col.kind}
                    data-column-size={col.size}
                    style={buildColumnStyle({
                      width: colWidth,
                      minWidth: col.minWidth,
                      maxWidth: colWidths[col.key] != null ? undefined : col.maxWidth,
                    })}
                  />
                );
              })}
            </colgroup>
            <thead>
              <tr>
                {showRowNumbers && (
                  <th className="nx-row-number-th nx-smart-row-number-cell nx-smart-header-cell-vars" style={rowNumberHeaderStyle}>#</th>
                )}
                {visibleColumns.map((col, columnIndex) => {
                  const columnState = tableEngine.getColumnState(col.key);
                  const shrink = col.shrink === true;
                  const actionSticky = col.key === 'actions' && stickyActionColumn;
                  // Keep truncation on table cells display-safe; inner ellipsis spans can be block.
                  // only apply it in fixed layout (where width is enforced) or when col.maxWidth bounds it
                  const shouldTruncate = !col.numeric && col.key !== 'actions' && !shrink && (layout === 'fixed' || !!col.maxWidth);
                  const nextResizableCol = visibleColumns[columnIndex + 1];
                  const resizableCol = sizingMode === 'adaptive' ? Boolean(
                    tableId
                    && col.key !== 'actions',
                  ) : Boolean(
                    tableId
                    && col.key !== 'actions'
                    && nextResizableCol
                    && nextResizableCol.key !== 'actions',
                  );
                  const effectiveWidth = columnEffectiveWidth(col);
                  return (
                    <th
                      key={col.key}
                      className={cn(
                        'nx-smart-header-cell-vars',
                        col.cellClassName,
                        getColumnKindClass(col),
                        col.key === 'actions' ? `noorix-actions-cell${actionSticky ? ` noorix-actions-sticky${compact ? ' noorix-actions-compact' : ''}` : (compact ? ' noorix-actions-compact' : '')}` : '',
                        col.numeric ? 'noorix-numeric-cell' : '',
                        shrink ? 'noorix-th-shrink' : '',
                        shouldTruncate ? 'noorix-table-cell-truncate' : '',
                      )}
                      style={buildHeaderCellStyle({ col, effectiveWidth, resizableCol, shrink, cellPad, compact })}
                      data-column-kind={col.kind}
                      data-column-size={col.size}
                      aria-sort={col.sortable ? columnState.ariaSort : undefined}
                      onClick={columnState.canSort ? () => tableEngine.toggleSort(col.key) : undefined}
                    >
                      {compactColumnLabel(col)}
                      {col.sortable && (
                        <span className={cn('text-[13px] ms-1', columnState.isSorted ? 'opacity-100' : 'opacity-30')}>
                          {columnState.sortIndicator}
                        </span>
                      )}
                      {resizableCol && (
                        <div
                          className="nx-col-resize-handle"
                          onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => {
                            const th = e.currentTarget.parentElement;
                            const nextTh = th?.nextElementSibling;
                            if (!th) return;
                            if (sizingMode === 'fixed' && (!nextTh || !nextResizableCol)) return;
                            handleResizeStart(
                              e,
                              col.key,
                              th.offsetWidth,
                              nextResizableCol?.key,
                              nextTh instanceof HTMLElement ? nextTh.offsetWidth : 0,
                            );
                          }}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <SmartTableDesktopRows
                rows={engineRows}
                visibleColumns={visibleColumns}
                effectiveCols={effectiveCols}
                emptyMsg={emptyMsg}
                compact={compact}
                layout={layout}
                cellPad={cellPad}
                cellFs={cellFs}
                showRowNumbers={showRowNumbers}
                rowNumberCellStyle={rowNumberCellStyle}
                paginationPage={pagination.page}
                safePageSize={safePageSize}
                stickyActionColumn={stickyActionColumn}
                rowKey={rowKey}
                columnEffectiveWidth={columnEffectiveWidth}
                getRowClassName={getRowClassName}
                getRowStyle={getRowStyle}
                isRowExpanded={isRowExpanded}
                renderExpandedRow={renderExpandedRow}
              />
            </tbody>
            {(footerCells || footerRow) && (
              <tfoot>
                <tr>
                  {footerRow
                    ? buildFooterCells({ footerRow, columns: visibleColumns, hiddenCols: new Set<string>(), showRowNumbers })
                    : footerCells}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ── تصفح الصفحات ── */}
      {!isLoading && (onPageChange || effectivePaginationMode === 'client') && (
        <SmartTablePagination
          page={pagination.page}
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
}

const SmartTable = memo(SmartTableInner) as typeof SmartTableInner;

export default SmartTable;
