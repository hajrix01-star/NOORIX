/**
 * SmartTable — مكون الجداول المركزي لنظام نوركس
 *
 * يعالج: Pagination | Global Search | Sorting | Empty State | Loading | Footer Totals
 *
 * الاستخدام:
 *   <SmartTable
 *     columns={[{ key, label, render?, align?, numeric?, sortable? }]}
 *     data={rows}
 *     total={100}
 *     page={1}
 *     pageSize={50}
 *     onPageChange={fn}
 *     isLoading={bool}
 *     isError={bool}
 *     errorMessage="..."
 *     footerRows={[{ colSpan?, value, align?, bold?, color? }[]]}
 *     title="الجدول"
 *     badge={<span>}
 *     searchValue={str}
 *     onSearchChange={fn}
 *     emptyMessage="لا توجد بيانات"
 *   />
 */
import React, { memo, useCallback, useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import Button from '../../ui/Button';
import Input  from '../../ui/Input';

// ── Column Definition ────────────────────────────────────────
/**
 * @typedef {Object} Column
 * @property {string}    key
 * @property {string}    label
 * @property {function}  [render]    - fn(value, row, rowIndex) → ReactNode
 * @property {'right'|'left'|'center'} [align]
 * @property {boolean}   [numeric]   - اختصار لـ align:'left' + font-numbers
 * @property {boolean}   [sortable]
 * @property {string}    [width]
 */

const ALIGN_MAP = { right: 'right', left: 'left', center: 'center', start: 'start', end: 'end' };

function getAlign(col) {
  if (col.align) return ALIGN_MAP[col.align] || 'start';
  /* GLOBAL SMART ALIGNMENT: الأعمدة المالية محاذاة لليمين دائماً (أرقام لاتينية 0.00) */
  if (col.numeric) return 'right';
  /* النصوص: start = يمين في العربي، يسار في الإنجليزي */
  return 'start';
}

// ── Pagination ───────────────────────────────────────────────
const Pagination = memo(function Pagination({ page, totalPages, onPageChange, t }) {
  const go = useCallback((p) => { if (p >= 1 && p <= totalPages) onPageChange(p); }, [totalPages, onPageChange]);

  if (totalPages <= 1) return null;
  return (
    <div className="nx-table-pagination">
      <Button size="sm" onClick={() => go(1)}        disabled={page === 1}>«</Button>
      <Button size="sm" onClick={() => go(page - 1)} disabled={page === 1}>‹</Button>
      <span className="nx-table-pagination__label">
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
  footerCells    = null,    // JSX لصف الإجماليات — null لإخفائه
  title,
  badge,
  searchValue,
  onSearchChange,
  emptyMessage,
  sortKey,
  sortDir        = 'desc',
  onSort,
  children,
  tableMinWidth  = 0,       // 0 = تلقائي حسب عدد الأعمدة (قانون الاحتواء الذكي)
  compact        = true,    // وضع مدمج افتراضي (ERP-style)
  showRowNumbers = false,   // عمود # لأرقام الصفوف
  innerPadding   = 0,      // مسافة بين الجدول والإطار (مثلاً 16)
  tableLayout,             // تلقائي: auto لـ ≤6 أعمدة، fixed لـ >6
  rowNumberWidth,          // عرض عمود # (مثلاً '3%')
  getRowClassName,         // (row, index) => string — للصفوف المشطوبة (مثلاً الملغاة)
  renderMobileCard,        // (row, index) => ReactNode — بطاقة الجوال، مفعّل تلقائياً على ≤700px
  stickyActionColumn = true, // false يزيل sticky عن عمود الإجراءات (أحياناً يتداخل مع RTL/تمرير أفقي)
}) {
  const { t } = useTranslation();

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 700px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const showCards = isMobile && typeof renderMobileCard === 'function';
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const colCount   = columns.length;
  const effectiveCols = colCount + (showRowNumbers ? 1 : 0);
  // قانون الاحتواء الذكي: ≤6 أعمدة → auto، >6 → fixed + min-width
  const isWideTable = effectiveCols > 6;
  const layout = tableLayout ?? (isWideTable ? 'fixed' : 'auto');
  const minW = tableMinWidth > 0 ? tableMinWidth : (isWideTable ? 1100 : 0);
  const cellPad    = compact ? { th: '6px 12px', td: '6px 12px' } : { th: '8px 14px', td: '8px 14px' };
  const cellFs     = compact ? 14 : 15;
  const errMsg     = errorMessage ?? t('loadDataFailed');
  const emptyMsg   = emptyMessage ?? t('noDataInPeriod');

  return (
    <div className="noorix-surface-card noorix-table-frame nx-table-frame nx-overflow-hidden" style={{ padding: innerPadding }}>
      {/* ── رأس الجدول ── */}
      {(title || badge || onSearchChange) && (
        <div className="nx-flex-center nx-gap-10" style={{ padding: '10px 16px', borderBottom: '1px solid var(--noorix-border)', flexWrap: 'wrap' }}>
          {title && <span className="nx-font-700 nx-text-lg" style={{ flexShrink: 0 }}>{title}</span>}
          {badge && <div className="nx-flex-center nx-gap-8" style={{ flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>{badge}</div>}
          {onSearchChange && (
            <Input
              type="search"
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('searchPlaceholder')}
              size="sm"
              className="nx-table-search"
              aria-label={t('searchPlaceholder')}
            />
          )}
        </div>
      )}

      {/* ── خطأ — يظهر دائماً عند isError حتى أثناء إعادة التحميل ── */}
      {isError && (
        <div className="nx-p-16 nx-text-md" style={{ margin: 12, background: 'rgba(239,68,68,0.08)', borderRadius: 10, color: '#ef4444' }}>
          ⚠ {errMsg}
        </div>
      )}

      {/* ── تحميل — Skeleton احترافي ── */}
      {isLoading && (
        <div className="nx-p-24" style={{ fontFamily: 'var(--noorix-font-primary)' }}>
          <div className="nx-flex-center nx-gap-12 nx-mb-16">
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--noorix-border)', borderTopColor: 'var(--noorix-accent-blue)', animation: 'noorix-spin 0.8s linear infinite' }} />
            <span className="nx-text-muted nx-text-md nx-font-500">{t('loading')}</span>
          </div>
          <div className="nx-flex-col nx-gap-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="nx-rounded" style={{ height: 44, background: 'linear-gradient(90deg, var(--noorix-bg-muted) 25%, var(--noorix-border-muted) 50%, var(--noorix-bg-muted) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            ))}
          </div>
        </div>
      )}

      {/* ── بطاقات الجوال ── */}
      {!isLoading && showCards && (
        <div>
          {data.length === 0 ? (
            <div className="nx-text-center nx-text-muted nx-text-base" style={{ padding: '24px 16px' }}>
              {emptyMsg}
            </div>
          ) : data.map((row, i) => (
            <div
              key={row.id ?? i}
              style={{
                padding: '12px 16px',
                borderBottom: i < data.length - 1 ? '1px solid var(--noorix-border)' : 'none',
              }}
            >
              {renderMobileCard(row, i)}
            </div>
          ))}
        </div>
      )}

      {/* ── الجدول — مطاطي على الديسك توب، تمرير أفقي على الجوال فقط ── */}
      {!isLoading && !showCards && (
        <div className="noorix-table-scroll-wrapper">
          <table className="noorix-table nx-w-full" style={{ tableLayout: layout, minWidth: minW || undefined, maxWidth: !isWideTable ? '100%' : undefined }}>
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
                  return (
                    <th
                      key={col.key}
                      className={`${col.key === 'actions' ? `noorix-actions-cell${actionSticky ? ` noorix-actions-sticky${compact ? ' noorix-actions-compact' : ''}` : (compact ? ' noorix-actions-compact' : '')}` : ''}${col.numeric ? ' noorix-numeric-cell' : ''}${shrink ? ' noorix-th-shrink' : ''}${!col.numeric && col.key !== 'actions' && !shrink ? ' noorix-cell-truncate' : ''}`}
                      style={{
                        padding: cellPad.th, fontWeight: 700, fontSize: compact ? 12 : 13, textAlign: align,
                        width: col.width ?? (shrink ? '1%' : undefined),
                        minWidth: layout === 'fixed' ? undefined : col.minWidth,
                        maxWidth: col.maxWidth,
                        cursor: col.sortable ? 'pointer' : 'default',
                        userSelect: col.sortable ? 'none' : 'auto',
                        whiteSpace: shrink || col.key === 'actions' ? 'nowrap' : 'normal',
                      }}
                      onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                    >
                      {col.label}
                      {col.sortable && (
                        <span className="nx-text-base" style={{ marginRight: 4, opacity: isSorted ? 1 : 0.3 }}>
                          {isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={effectiveCols} className="nx-text-center nx-text-muted" style={{
                    padding: compact ? '24px 16px' : '36px',
                    fontSize: compact ? 13 : 15,
                  }}>
                    {emptyMsg}
                  </td>
                </tr>
              ) : data.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className={`nx-border-b${typeof getRowClassName === 'function' && getRowClassName(row, i) ? ` ${getRowClassName(row, i)}` : ''}`}
                  style={{
                    background: i % 2 === 1 ? 'var(--noorix-bg-page)' : 'transparent',
                  }}
                >
                  {showRowNumbers && (
                    <td className="nx-text-center nx-text-muted nx-font-600" style={{ padding: cellPad.td, fontSize: cellFs, width: rowNumberWidth || 36, minWidth: rowNumberWidth ? undefined : 36 }}>
                      {(page - 1) * safePageSize + i + 1}
                    </td>
                  )}
                  {columns.map((col) => {
                    const value  = row[col.key];
                    const align  = getAlign(col);
                    const family = col.numeric ? 'var(--noorix-font-numbers)' : undefined;
                    const shrink = col.shrink === true;
                    const actionSticky = col.key === 'actions' && stickyActionColumn;
                    return (
                      <td
                        key={col.key}
                        className={`${col.key === 'actions' ? `noorix-actions-cell${actionSticky ? ` noorix-actions-sticky${compact ? ' noorix-actions-compact' : ''}` : (compact ? ' noorix-actions-compact' : '')}` : ''}${col.numeric ? ' noorix-numeric-cell' : ''}${shrink ? ' noorix-td-shrink' : ''}${!col.numeric && col.key !== 'actions' && !shrink ? ' noorix-cell-truncate' : ''}`}
                        style={{
                          padding: cellPad.td,
                          fontSize: cellFs,
                          textAlign: align,
                          fontFamily: family,
                          width: col.width,
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
                <tr>
                  {footerCells}
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
    </div>
  );
});

export default SmartTable;
