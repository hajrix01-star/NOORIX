/**
 * SmartTable — مكون الجداول المركزي لنظام نوركس
 * Pagination | Global Search | Sorting | Empty State | Loading | Mobile Cards | Column Resize
 */
import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { useIsNarrow768 } from '../../hooks/useMediaQuery';
import { useUiDir } from '../../hooks/useUiDir';
import Button from '../Button';
import Input from '../Input';
import { cn } from '../cn';
import type { SmartTableProps as SmartTablePropsBase } from './types';
import { columnLabel, getAlign } from './columnUtils';
import { buildFooterCells } from './buildFooterCells';

const COL_VIS_PANEL_MARGIN = 12;
const COL_VIS_PANEL_GAP = 6;
const COL_VIS_PANEL_FALLBACK_W = 220;
const COL_VIS_PANEL_FALLBACK_H = 320;

/** يثبّت لوحة الأعمدة داخل الشاشة (جوال RTL/LTR) */
export function placeColVisPanel(btn: HTMLElement, panel: HTMLElement): { top: number; left: number } {
  const rect = btn.getBoundingClientRect();
  const w = panel.offsetWidth || COL_VIS_PANEL_FALLBACK_W;
  const h = panel.offsetHeight || COL_VIS_PANEL_FALLBACK_H;
  const maxLeft = window.innerWidth - COL_VIS_PANEL_MARGIN - w;
  const isRtl = typeof document !== 'undefined'
    && (document.documentElement.dir === 'rtl'
      || getComputedStyle(document.documentElement).direction === 'rtl');
  let left = isRtl ? rect.left : rect.right - w;
  left = Math.max(COL_VIS_PANEL_MARGIN, Math.min(left, maxLeft));
  let top = rect.bottom + COL_VIS_PANEL_GAP;
  if (top + h > window.innerHeight - COL_VIS_PANEL_MARGIN) {
    top = Math.max(COL_VIS_PANEL_MARGIN, rect.top - h - COL_VIS_PANEL_GAP);
  }
  return { top, left };
}

// ── Pagination ───────────────────────────────────────────────
type PaginationBarProps = {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  t: (key: string, ...args: unknown[]) => string;
};

const Pagination = memo(function Pagination({ page, totalPages, onPageChange, t }: PaginationBarProps) {
  const go = useCallback(
    (p: number) => {
      if (p >= 1 && p <= totalPages) onPageChange(p);
    },
    [totalPages, onPageChange],
  );
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
    innerPadding = 0,
    tableLayout,
    rowNumberWidth,
    getRowClassName,
    getRowStyle,
    renderMobileCard,
    /** صفوف متناوبة الخلفية في عرض بطاقات الجوال — افتراضي مفعّل؛ عطّل بـ false */
    stripeMobileCards = true,
    renderCompactRow,
    stickyActionColumn = true,
    /** معرف فريد للجدول — لما يُمرَّر يُفعّل السحب لتغيير عرض الأعمدة + الحفظ في localStorage */
    tableId,
  } = props;
  const { t } = useTranslation();
  const dir = useUiDir();

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

    const onMove = (ev: any) => {
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
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [dir, tableId]);

  // ── Column Visibility ──────────────────────────────────────────
  const [showColPanel, setShowColPanel] = useState(false);
  const [colPanelPos, setColPanelPos] = useState<{ top: number; left: number } | null>(null);
  const colBtnRef  = useRef<HTMLButtonElement | null>(null);
  const colPanelRef = useRef<HTMLDivElement | null>(null);

  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    if (!tableId) return new Set<string>();
    try {
      const saved = localStorage.getItem(`nx-col-vis:${tableId}`);
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const syncColPanelPosition = useCallback(() => {
    const btn = colBtnRef.current;
    const panel = colPanelRef.current;
    if (!btn || !panel) return;
    setColPanelPos(placeColVisPanel(btn, panel));
  }, []);

  useLayoutEffect(() => {
    if (!showColPanel) {
      setColPanelPos(null);
      return undefined;
    }
    syncColPanelPosition();
    const onReflow = () => syncColPanelPosition();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [showColPanel, syncColPanelPosition, hiddenCols.size]);

  useEffect(() => {
    if (!showColPanel) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!colPanelRef.current?.contains(target) && !colBtnRef.current?.contains(target)) {
        setShowColPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColPanel]);

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
    setShowColPanel(false);
  }, [tableId]);

  /** محاذاة مع @media (max-width: 768px) — تجنّب جدول عريض + فراغ أبيض على تابلت/جوال */
  const isNarrow = useIsNarrow768();

  const showCompact  = isNarrow && typeof renderCompactRow === 'function';
  const showCards    = isNarrow && !showCompact && typeof renderMobileCard === 'function';
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
  const showTableHeaderRow = Boolean(title || badge || (onSearchChange && showSearchInHeader) || tableId);
  const hideableCols = columns.filter((c: any) => c.key !== 'actions');

  return (
    <div
      className={cn(
        'noorix-table-frame min-w-0 max-w-full',
        (renderCompactRow || renderMobileCard) && 'max-md:overflow-x-hidden',
      )}
      style={{ padding: innerPadding }}
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
              <div className="relative">
                <button
                  ref={colBtnRef}
                  className={`nx-col-vis-btn${hiddenCols.size > 0 ? ' nx-col-vis-btn--active' : ''}`}
                  title="إظهار / إخفاء الأعمدة"
                  aria-label="إظهار / إخفاء الأعمدة"
                  onClick={() => setShowColPanel((v: any) => !v)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                  </svg>
                  {hiddenCols.size > 0 && (
                    <span className="nx-col-vis-badge">{hiddenCols.size}</span>
                  )}
                </button>
                {showColPanel && typeof document !== 'undefined' && createPortal(
                  <div
                    ref={colPanelRef}
                    className={cn('nx-col-vis-panel', 'nx-col-vis-panel--viewport', !colPanelPos && 'nx-col-vis-panel--measuring')}
                    style={colPanelPos ? { top: colPanelPos.top, left: colPanelPos.left } : undefined}
                    role="dialog"
                    aria-label="إظهار / إخفاء الأعمدة"
                  >
                    <div className="nx-col-vis-panel__header">
                      <span>الأعمدة</span>
                      {hiddenCols.size > 0 && (
                        <button type="button" className="nx-col-vis-reset" onClick={resetColVis}>إعادة تعيين</button>
                      )}
                    </div>
                    {hideableCols.map((col: any) => (
                      <label key={col.key} className="nx-col-vis-item">
                        <input
                          type="checkbox"
                          checked={!hiddenCols.has(col.key)}
                          onChange={() => toggleColVis(col.key)}
                        />
                        <span>{columnLabel(col)}</span>
                      </label>
                    ))}
                  </div>,
                  document.body,
                )}
              </div>
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
              className="w-6 h-6 rounded-full border-2 border-noorix-border border-t-noorix-blue"
              style={{ animation: 'noorix-spin 0.8s linear infinite' }}
            />
            <span className="text-noorix-muted text-[14px] font-medium">{t('loading')}</span>
          </div>
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((i: any) => (
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

      {/* ── صفوف مضغوطة (List-Row pattern) ── */}
      {!isLoading && showCompact && (
        <div>
          {data.length === 0 ? (
            <div className="text-center text-noorix-muted text-[13px] py-6 px-4">
              {emptyMsg}
            </div>
          ) : data.map((row: any, i: any) => (
            <div
              key={row.id ?? i}
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
        <div className="flex flex-col gap-2 px-3 py-2">
          {data.length === 0 ? (
            <div className="text-center text-noorix-muted text-[13px] py-6 px-4">
              {emptyMsg}
            </div>
          ) : data.map((row: any, i: any) => (
            <div
              key={row.id ?? i}
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
            className="noorix-table w-full"
            style={{ tableLayout: layout, minWidth: minW || undefined, maxWidth: !isWideTable ? '100%' : undefined }}
          >
            <thead>
              <tr style={{ textAlign: 'right' }}>
                {showRowNumbers && (
                  <th style={{ padding: cellPad.th, fontWeight: 700, fontSize: compact ? 11 : 12, width: rowNumberWidth || 36, minWidth: rowNumberWidth ? undefined : 36, textAlign: 'center' }}>#</th>
                )}
                {columns.map((col: any) => {
                  const isHidden = hiddenCols.has(col.key);
                  if (isHidden) {
                    return <th key={col.key} aria-hidden="true" style={{ width: 0, maxWidth: 0, padding: 0, overflow: 'hidden', border: 'none' }} />;
                  }
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
                        padding: cellPad.th, fontWeight: 700, fontSize: compact ? 12 : 13, textAlign: align as React.CSSProperties['textAlign'],
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
                      {columnLabel(col)}
                      {col.sortable && (
                        <span className="text-[13px] opacity-30 ms-1" style={{ opacity: isSorted ? 1 : 0.3 }}>
                          {isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      )}
                      {resizableCol && (
                        <div
                          className="nx-col-resize-handle"
                          onMouseDown={(e: any) => {
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
              ) : data.map((row: any, i: any) => (
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
                  {columns.map((col: any) => {
                    if (hiddenCols.has(col.key)) {
                      return <td key={col.key} aria-hidden="true" style={{ width: 0, maxWidth: 0, padding: 0, overflow: 'hidden', border: 'none' }} />;
                    }
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
                          textAlign: align as React.CSSProperties['textAlign'],
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
            {(footerCells || footerRow) && (
              <tfoot>
                <tr>
                  {footerRow
                    ? buildFooterCells({ footerRow, columns, hiddenCols, showRowNumbers, rowNumberWidth, cellPad })
                    : footerCells}
                </tr>
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
      {footer}
    </div>
  );
});

export default SmartTable;
