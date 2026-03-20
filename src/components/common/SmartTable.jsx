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
    <div style={{
      padding: '10px 16px', borderTop: '1px solid var(--noorix-border)',
      display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexWrap: 'wrap',
    }}>
      <button type="button" className="noorix-btn-nav" onClick={() => go(1)} disabled={page === 1}>«</button>
      <button type="button" className="noorix-btn-nav" onClick={() => go(page - 1)} disabled={page === 1}>‹</button>
      <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', padding: '0 8px' }}>
        {t('pageLabel', page, totalPages)}
      </span>
      <button type="button" className="noorix-btn-nav" onClick={() => go(page + 1)} disabled={page === totalPages}>›</button>
      <button type="button" className="noorix-btn-nav" onClick={() => go(totalPages)} disabled={page === totalPages}>»</button>
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
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
    <div className="noorix-surface-card noorix-table-frame" style={{ overflow: 'hidden', padding: innerPadding }}>
      {/* ── رأس الجدول ── */}
      {(title || badge || onSearchChange) && (
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--noorix-border)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          {title && <span style={{ fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{title}</span>}
          {badge && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>{badge}</div>}
          {onSearchChange && (
            <input
              type="search"
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('searchPlaceholder')}
              style={{
                marginInlineStart: 'auto', padding: '5px 10px', borderRadius: 4, fontSize: 12.5,
                border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-page)',
                minWidth: 120, width: '100%', maxWidth: 220, outline: 'none',
                flex: '0 1 auto',
              }}
            />
          )}
        </div>
      )}

      {/* ── خطأ ── */}
      {isError && !isLoading && (
        <div style={{
padding: 16, margin: 12, background: 'rgba(239,68,68,0.08)',
        borderRadius: 10, color: '#ef4444', fontSize: 14,
        }}>
          ⚠️ {errMsg}
        </div>
      )}

      {/* ── تحميل — Skeleton احترافي ── */}
      {isLoading && (
        <div style={{ padding: 24, fontFamily: 'var(--noorix-font-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--noorix-border)', borderTopColor: 'var(--noorix-accent-blue)', animation: 'noorix-spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--noorix-text-muted)', fontSize: 14, fontWeight: 500 }}>{t('loading')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ height: 44, borderRadius: 8, background: 'linear-gradient(90deg, var(--noorix-bg-muted) 25%, var(--noorix-border-muted) 50%, var(--noorix-bg-muted) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            ))}
          </div>
        </div>
      )}

      {/* ── بطاقات الجوال ── */}
      {!isLoading && showCards && (
        <div>
          {data.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--noorix-text-muted)', fontSize: 13 }}>
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
          <table className="noorix-table" style={{ width: '100%', tableLayout: layout, minWidth: minW || undefined, maxWidth: !isWideTable ? '100%' : undefined }}>
            <thead>
              <tr style={{ textAlign: 'right' }}>
                {showRowNumbers && (
                  <th style={{ padding: cellPad.th, fontWeight: 700, fontSize: compact ? 11 : 12, width: rowNumberWidth || 36, minWidth: rowNumberWidth ? undefined : 36, textAlign: 'center' }}>#</th>
                )}
                {columns.map((col) => {
                  const align = getAlign(col);
                  const isSorted = sortKey === col.key;
                  const shrink = col.shrink === true;
                  return (
                    <th
                      key={col.key}
                      className={`${col.key === 'actions' ? `noorix-actions-cell noorix-actions-sticky${compact ? ' noorix-actions-compact' : ''}` : ''}${col.numeric ? ' noorix-numeric-cell' : ''}${shrink ? ' noorix-th-shrink' : ''}${!col.numeric && col.key !== 'actions' && !shrink ? ' noorix-cell-truncate' : ''}`}
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
                        <span style={{ marginRight: 4, opacity: isSorted ? 1 : 0.3, fontSize: 13 }}>
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
                  <td colSpan={effectiveCols} style={{
                    padding: compact ? '24px 16px' : '36px', textAlign: 'center',
                    color: 'var(--noorix-text-muted)', fontSize: compact ? 13 : 15,
                  }}>
                    {emptyMsg}
                  </td>
                </tr>
              ) : data.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className={typeof getRowClassName === 'function' ? getRowClassName(row, i) : undefined}
                  style={{
                    borderBottom: '1px solid var(--noorix-border)',
                    background: i % 2 === 1 ? 'var(--noorix-bg-page)' : 'transparent',
                  }}
                >
                  {showRowNumbers && (
                    <td style={{ padding: cellPad.td, fontSize: cellFs, textAlign: 'center', color: 'var(--noorix-text-muted)', fontWeight: 600, width: rowNumberWidth || 36, minWidth: rowNumberWidth ? undefined : 36 }}>
                      {(page - 1) * pageSize + i + 1}
                    </td>
                  )}
                  {columns.map((col) => {
                    const value  = row[col.key];
                    const align  = getAlign(col);
                    const family = col.numeric ? 'var(--noorix-font-numbers)' : undefined;
                    const shrink = col.shrink === true;
                    return (
                      <td
                        key={col.key}
                        className={`${col.key === 'actions' ? `noorix-actions-cell noorix-actions-sticky${compact ? ' noorix-actions-compact' : ''}` : ''}${col.numeric ? ' noorix-numeric-cell' : ''}${shrink ? ' noorix-td-shrink' : ''}${!col.numeric && col.key !== 'actions' && !shrink ? ' noorix-cell-truncate' : ''}`}
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
