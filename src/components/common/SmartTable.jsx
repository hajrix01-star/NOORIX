/**
 * SmartTable — مكون الجداول المركزي لنظام نوركس
 * Pagination | Global Search | Sorting | Empty State | Loading | Mobile Cards | Column Resize
 */
import React, { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useIsNarrow700 } from '../../hooks/useMediaQuery';
import { useUiDir } from '../../hooks/useUiDir';
import Button from '../../ui/Button';
import Input  from '../../ui/Input';

const ALIGN_MAP = { right: 'right', left: 'left', center: 'center', start: 'start', end: 'end' };

function getAlign(col) {
  if (col.align) return ALIGN_MAP[col.align] || 'start';
  if (col.numeric) return 'right';
  return 'start';
}

// ── Pagination ───────────────────────────────────────────────
const Pagination = memo(function Pagination({ page, totalPages, onPageChange, t }) {
  const go = useCallback((p) => { if (p >= 1 && p <= totalPages) onPageChange(p); }, [totalPages, onPageChange]);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-noorix-border">
      <Button size="sm" onClick={() => go(1)}        disabled={page === 1}>«</Button>
      <Button size="sm" onClick={() => go(page - 1)} disabled={page === 1}>‹</Button>
      <span className="text-[13px] text-noorix-muted font-medium px-2">
        {t('pageLabel', page, totalPages)}
      </span>
      <Button size="sm" onClick={() => go(page + 1)} disabled={page === totalPages}>›</Button>
      <Button size="sm" onClick={() => go(totalPages)} disabled={page === totalPages}>»</Button>
    </div>
  );
});

// ── SmartTable ───────────────────────────────────────────────
const SmartTable = memo(function SmartTable({
  columns        = [],
  data           = [],
  total          = 0,
  page           = 1,
  pageSize       = 50,
  onPageChange,
  isLoading      = false,
  isError        = false,
  errorMessage   = 'فشل تحميل البيانات',
  footerCells    = null,
  title,
  badge,
  searchValue,
  onSearchChange,
  /** عند false يبقى البحث تحت سيطرة الشاشة (حقل خارجي) مع الإبقاء على عنوان/شارة الجدول */
  showSearchInHeader = true,
  emptyMessage,
  sortKey,
  sortDir        = 'desc',
  onSort,
  children,
  tableMinWidth  = 0,
  compact        = true,
  showRowNumbers = false,
  innerPadding   = 0,
  tableLayout,
  rowNumberWidth,
  getRowClassName,
  getRowStyle,
  renderMobileCard,
  stickyActionColumn = true,
  /** معرف فريد للجدول — لما يُمرَّر يُفعّل السحب لتغيير عرض الأعمدة + الحفظ في localStorage */
  tableId,
}) {
  const { t } = useTranslation();
  const dir = useUiDir();

  // ── Column Resize ──────────────────────────────────────────────
  const resizingRef = useRef(null);
  const [colWidths, setColWidths] = useState(() => {
    if (!tableId) return {};
    try {
      const saved = localStorage.getItem(`nx-col-widths:${tableId}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const handleResizeStart = useCallback((e, colKey, startW) => {
    e.preventDefault();
    e.stopPropagation();
    const dirMult = dir === 'rtl' ? -1 : 1;
    resizingRef.current = { colKey, startX: e.clientX, startW };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!resizingRef.current) return;
      const delta = (ev.clientX - resizingRef.current.startX) * dirMult;
      const newW = Math.max(40, resizingRef.current.startW + delta);
      setColWidths((prev) => ({ ...prev, [colKey]: Math.round(newW) }));
    };

    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (tableId) {
        setColWidths((prev) => {
          try { localStorage.setItem(`nx-col-widths:${tableId}`, JSON.stringify(prev)); } catch { /* noop */ }
          return prev;
        });
      }
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [dir, tableId]);

  const isNarrow = useIsNarrow700();

  const showCards    = isNarrow && typeof renderMobileCard === 'function';
  const safePageSize = Math.max(1, pageSize);
  const totalPages   = Math.max(1, Math.ceil(total / safePageSize));
  const colCount     = columns.length;
  const effectiveCols = colCount + (showRowNumbers ? 1 : 0);
  const isWideTable  = effectiveCols > 6;
  const layout       = tableLayout ?? (isWideTable ? 'fixed' : 'auto');
  const minW         = tableMinWidth > 0 ? tableMinWidth : (isWideTable ? 1100 : 0);
  const cellPad      = compact ? { th: '6px 12px', td: '6px 12px' } : { th: '8px 14px', td: '8px 14px' };
  const cellFs       = compact ? 14 : 15;
  const errMsg       = errorMessage ?? t('loadDataFailed');
  const emptyMsg     = emptyMessage ?? t('noDataInPeriod');
  const showTableHeaderRow = Boolean(title || badge || (onSearchChange && showSearchInHeader));

  return (
    <div
      className="noorix-table-frame min-w-0"
      style={{ padding: innerPadding }}
    >
      {/* ── رأس الجدول ── */}
      {showTableHeaderRow && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap px-4 py-2.5 border-b border-noorix-border">
          <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
            {title && <span className="font-bold text-[15px] shrink-0">{title}</span>}
            {badge && <div className="flex items-center gap-2 flex-wrap min-w-0">{badge}</div>}
          </div>
          {onSearchChange && showSearchInHeader && (
            <Input
              type="search"
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('searchPlaceholder')}
              size="sm"
              className="noorix-table-search shrink-0"
              aria-label={t('searchPlaceholder')}
            />
          )}
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
              className="w-6 h-6 rounded-full border-2 border-noorix-border border-t-noorix-blue"
              style={{ animation: 'noorix-spin 0.8s linear infinite' }}
            />
            <span className="text-noorix-muted text-[14px] font-medium">{t('loading')}</span>
          </div>
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="rounded-lg h-11"
                style={{
                  background: 'linear-gradient(90deg, var(--noorix-bg-muted) 25%, var(--noorix-border-muted) 50%, var(--noorix-bg-muted) 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── بطاقات الجوال ── */}
      {!isLoading && showCards && (
        <div>
          {data.length === 0 ? (
            <div className="text-center text-noorix-muted text-[13px] py-6 px-4">
              {emptyMsg}
            </div>
          ) : data.map((row, i) => (
            <div
              key={row.id ?? i}
              className={`px-4 py-3${i < data.length - 1 ? ' border-b border-noorix-border' : ''}`}
            >
              {renderMobileCard(row, i)}
            </div>
          ))}
        </div>
      )}

      {/* ── الجدول ── */}
      {!isLoading && !showCards && (
        <div className="overflow-x-auto noorix-table-scroll-wrapper">
          <table
            className="noorix-table w-full"
            style={{ tableLayout: layout, minWidth: minW || undefined, maxWidth: !isWideTable ? '100%' : undefined }}
          >
            <thead>
              <tr style={{ textAlign: 'right' }}>
                {showRowNumbers && (
                  <th style={{ padding: cellPad.th, fontWeight: 700, fontSize: compact ? 11 : 12, width: rowNumberWidth || 36, minWidth: rowNumberWidth ? undefined : 36, textAlign: 'center' }}>#</th>
                )}
                {columns.map((col) => {
                  const align = getAlign(col);
                  const isSorted = sortKey === col.key;
                  const shrink = col.shrink === true;
                  const actionSticky = col.key === 'actions' && stickyActionColumn;
                  // noorix-cell-truncate adds white-space:nowrap which expands cells in auto layout
                  // only apply it in fixed layout (where width is enforced) or when col.maxWidth bounds it
                  const shouldTruncate = !col.numeric && col.key !== 'actions' && !shrink && (layout === 'fixed' || !!col.maxWidth);
                  const resizableCol = tableId && col.key !== 'actions';
                  const effectiveWidth = colWidths[col.key] != null
                    ? colWidths[col.key]
                    : (col.width ?? (shrink ? '1%' : undefined));
                  return (
                    <th
                      key={col.key}
                      className={`${col.key === 'actions' ? `noorix-actions-cell${actionSticky ? ` noorix-actions-sticky${compact ? ' noorix-actions-compact' : ''}` : (compact ? ' noorix-actions-compact' : '')}` : ''}${col.numeric ? ' noorix-numeric-cell' : ''}${shrink ? ' noorix-th-shrink' : ''}${shouldTruncate ? ' noorix-cell-truncate' : ''}`}
                      style={{
                        padding: cellPad.th, fontWeight: 700, fontSize: compact ? 12 : 13, textAlign: align,
                        position: resizableCol ? 'relative' : undefined,
                        width: effectiveWidth,
                        minWidth: layout === 'fixed' ? undefined : col.minWidth,
                        maxWidth: resizableCol ? undefined : col.maxWidth,
                        cursor: col.sortable ? 'pointer' : 'default',
                        userSelect: col.sortable ? 'none' : 'auto',
                        whiteSpace: shrink || col.key === 'actions' ? 'nowrap' : 'normal',
                        overflow: resizableCol ? 'hidden' : undefined,
                      }}
                      onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                    >
                      {col.label}
                      {col.sortable && (
                        <span className="text-[13px] opacity-30 ms-1" style={{ opacity: isSorted ? 1 : 0.3 }}>
                          {isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      )}
                      {resizableCol && (
                        <div
                          className="nx-col-resize-handle"
                          onMouseDown={(e) => {
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
                  <td colSpan={effectiveCols} className="text-center text-noorix-muted" style={{
                    padding: compact ? '24px 16px' : '36px',
                    fontSize: compact ? 13 : 15,
                  }}>
                    {emptyMsg}
                  </td>
                </tr>
              ) : data.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className={`border-b border-noorix-border${typeof getRowClassName === 'function' && getRowClassName(row, i) ? ` ${getRowClassName(row, i)}` : ''}`}
                  style={{ background: i % 2 === 1 ? 'var(--noorix-bg-page)' : 'transparent', ...(typeof getRowStyle === 'function' ? getRowStyle(row, i) : null) }}
                >
                  {showRowNumbers && (
                    <td className="text-center text-noorix-muted font-semibold" style={{ padding: cellPad.td, fontSize: cellFs, width: rowNumberWidth || 36, minWidth: rowNumberWidth ? undefined : 36 }}>
                      {(page - 1) * safePageSize + i + 1}
                    </td>
                  )}
                  {columns.map((col) => {
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
                        className={`${col.key === 'actions' ? `noorix-actions-cell${actionSticky ? ` noorix-actions-sticky${compact ? ' noorix-actions-compact' : ''}` : (compact ? ' noorix-actions-compact' : '')}` : ''}${col.numeric ? ' noorix-numeric-cell' : ''}${shrink ? ' noorix-td-shrink' : ''}${shouldTruncate ? ' noorix-cell-truncate' : ''}`}
                        style={{
                          padding: cellPad.td,
                          fontSize: cellFs,
                          textAlign: align,
                          fontFamily: family,
                          width: tdEffectiveWidth,
                          minWidth: layout === 'fixed' ? undefined : col.minWidth,
                          maxWidth: col.maxWidth,
                          whiteSpace: shrink ? 'nowrap' : undefined,
                        }}
                      >
                        {col.render ? col.render(value, row, i) : (value ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {footerCells && (
              <tfoot>
                <tr>{footerCells}</tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ── تصفح الصفحات ── */}
      {!isLoading && onPageChange && (
        <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} t={t} />
      )}

      {children}
    </div>
  );
});

export default SmartTable;
