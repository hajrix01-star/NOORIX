/**
 * SmartTable — مكون الجداول المركزي لنظام نوركس
 * Pagination | Global Search | Sorting | Empty State | Loading | Mobile Cards | Column Resize
 */
import React, { memo, useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useIsNarrow768 } from '../responsive';
import { useUiDir } from '../../hooks/useUiDir';
import { cn } from '../cn';
import type { SmartTableProps as SmartTablePropsBase } from './types';
import { columnLabel, getAlign } from './columnUtils';
import { buildFooterCells } from './buildFooterCells';
import { getColumnKindClass, normalizeSmartColumn } from './columnPresets';
import { useSmartTableEngine } from './tableEngine';
import SmartTablePagination from './SmartTablePagination';
import { placeColVisPanel } from './SmartTableColumnVisibility';
import SmartTableHeader from './SmartTableHeader';
import { SmartTableErrorState, SmartTableLoadingState } from './SmartTableStates';
import { SmartTableCompactRows, SmartTableMobileCards } from './SmartTableResponsiveRows';
import { useSmartTableColumnResize } from './useSmartTableColumnResize';
import { useSmartTableColumnVisibility } from './useSmartTableColumnVisibility';
import {
  DEFAULT_INNER_PADDING,
  SMART_TABLE_COMPACT_PADDING,
  SMART_TABLE_RELAXED_BODY_PADDING,
  SMART_TABLE_RELAXED_HEADER_PADDING,
  buildBodyCellStyle,
  buildColumnStyle,
  buildFrameStyle,
  buildHeaderCellStyle,
  buildRowNumberCellStyle,
  buildRowNumberHeaderStyle,
  buildRowStyle,
  buildTableStyle,
  DEFAULT_ROW_NUMBER_WIDTH,
} from './smartTableStyles';

export { placeColVisPanel };

// ── SmartTable ───────────────────────────────────────────────
const SmartTable = memo(function SmartTable(props: SmartTablePropsBase) {
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

  const { colWidths, handleResizeStart } = useSmartTableColumnResize({ dir, tableId });
  const {
    hiddenCols,
    visibleColumns,
    hideableCols,
    toggleColVis,
    resetColVis,
  } = useSmartTableColumnVisibility({ columns: normalizedColumns, tableId });

  /** محاذاة مع @media (max-width: 768px) — تجنّب جدول عريض + فراغ أبيض على تابلت/جوال */
  const isNarrow = useIsNarrow768();

  const showCompact  = isNarrow && typeof renderCompactRow === 'function';
  const showCards    = isNarrow && !showCompact && typeof renderMobileCard === 'function';
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
  const minW         = tableMinWidth === 0 || tableMinWidth === ''
    ? undefined
    : (tableMinWidth != null ? tableMinWidth : (isWideTable ? 1100 : undefined));
  const cellPad      = compact
    ? { th: SMART_TABLE_COMPACT_PADDING, td: SMART_TABLE_COMPACT_PADDING }
    : { th: SMART_TABLE_RELAXED_HEADER_PADDING, td: SMART_TABLE_RELAXED_BODY_PADDING };
  const rowNumW      = DEFAULT_ROW_NUMBER_WIDTH;
  const cellFs       = compact ? 14 : 15;
  const errMsg       = errorMessage ?? t('loadDataFailed');
  const emptyMsg     = emptyMessage ?? t('noDataInPeriod');
  const frameStyle = buildFrameStyle(innerPadding);
  const tableStyle = buildTableStyle({ layout, minW, isWideTable });
  const rowNumberHeaderStyle = buildRowNumberHeaderStyle({ cellPad, compact, rowNumW });
  const rowNumberCellStyle = buildRowNumberCellStyle({ cellPad, cellFs, rowNumW });
  const columnEffectiveWidth = (col: any) => (
    colWidths[col.key] != null
      ? colWidths[col.key]
      : (col.width ?? (col.shrink === true ? '1%' : undefined))
  );
  /** على الجوال مع بطاقات فقط: لا نعرض شريط إخفاء الأعمدة (يضيق المحتوى ويبدو كزر عائم) */
  const showTableHeaderRow = Boolean(
    title || badge || ((onSearchChange || effectiveFilteringMode === 'client') && showSearchInHeader) || (tableId && !showCards),
  );
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
          onToggleColumn={toggleColVis}
          onResetColumns={resetColVis}
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
              {visibleColumns.map((col: any) => {
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
                {visibleColumns.map((col: any) => {
                  const columnState = tableEngine.getColumnState(col.key);
                  const shrink = col.shrink === true;
                  const actionSticky = col.key === 'actions' && stickyActionColumn;
                  // Keep truncation on table cells display-safe; inner ellipsis spans can be block.
                  // only apply it in fixed layout (where width is enforced) or when col.maxWidth bounds it
                  const shouldTruncate = !col.numeric && col.key !== 'actions' && !shrink && (layout === 'fixed' || !!col.maxWidth);
                  const resizableCol = Boolean(tableId && col.key !== 'actions');
                  const effectiveWidth = columnEffectiveWidth(col);
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
                      style={buildHeaderCellStyle({ col, effectiveWidth, resizableCol, shrink, cellPad, compact })}
                      data-column-kind={col.kind}
                      data-column-size={col.size}
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
              {engineRows.length === 0 ? (
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
                  style={buildRowStyle({ row, index: i, getRowStyle })}
                >
                  {showRowNumbers && (
                    <td className="nx-row-number-td nx-smart-row-number-cell nx-smart-body-cell-vars text-center font-semibold" style={rowNumberCellStyle}>
                      {(pagination.page - 1) * safePageSize + i + 1}
                    </td>
                  )}
                  {visibleColumns.map((col: any) => {
                    const value  = row[col.key];
                    const align  = getAlign(col);
                    const family = col.numeric ? 'var(--noorix-font-numbers)' : undefined;
                    const shrink = col.shrink === true;
                    const actionSticky = col.key === 'actions' && stickyActionColumn;
                    const shouldTruncate = !col.numeric && col.key !== 'actions' && !shrink && (layout === 'fixed' || !!col.maxWidth);
                    const tdEffectiveWidth = columnEffectiveWidth(col);
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
                        style={buildBodyCellStyle({
                          col,
                          tdEffectiveWidth,
                          align: align as React.CSSProperties['textAlign'],
                          family,
                          shrink,
                          cellPad,
                          cellFs,
                        })}
                        data-column-kind={col.kind}
                        data-column-size={col.size}
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
});

export default SmartTable;
