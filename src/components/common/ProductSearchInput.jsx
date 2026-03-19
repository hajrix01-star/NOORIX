/**
 * ProductSearchInput — بحث ذكي عن الصنف (عربي + إنجليزي)
 * يعرض الحجم والسعر من آخر طلب (lastPrice من variants)
 * يستخدم Portal للقائمة المنسدلة لتجنب القص (overflow)
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { fmt } from '../../utils/format';

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 8,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box',
  minHeight: 44,
};

/** تطبيع النص للبحث (إزالة التشكيل، توحيد المسافات) */
function normalizeForSearch(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u064B-\u0652\u0670]/g, '') // إزالة التشكيل
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** فحص تطابق البحث — عربي أو إنجليزي */
function matchesSearch(product, searchNorm) {
  if (!searchNorm) return true;
  const ar = normalizeForSearch(product.nameAr || '');
  const en = normalizeForSearch(product.nameEn || '');
  return ar.includes(searchNorm) || en.includes(searchNorm);
}

export function ProductSearchInput({
  products = [],
  productsById,
  value, // productId
  onChange,
  onSelectProduct,
  placeholder = '— اختر الصنف —',
  style = {},
  compact = false,
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [dropdownRect, setDropdownRect] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedProduct = value ? productsById?.get(value) : null;
  const displayValue = selectedProduct ? (selectedProduct.nameAr || selectedProduct.nameEn || '') : '';

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query);
    if (!q) return products;
    return products.filter((p) => matchesSearch(p, q));
  }, [products, query]);

  function updateDropdownPosition() {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const isRtl = document.documentElement.dir === 'rtl';
    const minW = 320;
    const maxW = window.innerWidth - 24;
    const w = Math.min(Math.max(rect.width, minW), maxW);
    // RTL: محاذاة يمين القائمة مع يمين الحقل (بداية النص)
    // LTR: محاذاة يسار القائمة مع يسار الحقل
    let left = isRtl ? rect.right - w : rect.left;
    if (left < 12) left = 12;
    if (left + w > window.innerWidth - 12) left = window.innerWidth - w - 12;
    setDropdownRect({ top: rect.bottom + 4, left, width: w });
  }

  useEffect(() => {
    if (!open) return;
    setHighlightIdx(0);
    updateDropdownPosition();
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => updateDropdownPosition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (!containerRef.current) return;
      const target = e.target;
      if (containerRef.current.contains(target)) return;
      if (target?.closest?.('[data-product-search-dropdown]')) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectProduct(p) {
    const variants = Array.isArray(p?.variants) ? p.variants : [];
    const first = variants[0];
    onChange?.(p.id);
    onSelectProduct?.({
      productId: p.id,
      variantKey: first ? `${first.size || ''}|${first.packaging || ''}|${first.unit || ''}|0` : '',
      size: first?.size || '',
      packaging: first?.packaging || '',
      unit: first?.unit || 'piece',
      unitPrice: first?.lastPrice ? String(first.lastPrice) : (p?.lastPrice ? String(p.lastPrice) : ''),
    });
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setHighlightIdx((i) => Math.max(i - 1, 0));
      e.preventDefault();
    } else if (e.key === 'Enter' && filtered[highlightIdx]) {
      selectProduct(filtered[highlightIdx]);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      e.preventDefault();
    }
  }

  const inputPadding = compact ? { padding: '6px 10px', minHeight: 36, fontSize: 14 } : {};

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <input
        ref={inputRef}
        type="text"
        value={open ? query : displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange?.('');
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        style={{ ...inputStyle, ...inputPadding }}
      />
      {open &&
        dropdownRect &&
        createPortal(
          <div
            data-product-search-dropdown
            style={{
              position: 'fixed',
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
              maxHeight: 280,
              overflowY: 'auto',
              overflowX: 'hidden',
              background: 'var(--noorix-bg-surface)',
              border: '1px solid var(--noorix-border)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 10001,
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--noorix-text-muted)', fontSize: 13, textAlign: 'center' }}>
                {t('ordersNoSearchResults') || 'لا توجد نتائج'}
              </div>
            ) : (
              filtered.map((p, i) => {
                const variants = Array.isArray(p?.variants) ? p.variants : [];
                const first = variants[0];
                const lastPrice = first?.lastPrice ?? p?.lastPrice ?? 0;
                const variantLabel = first ? [first.size, first.packaging, first.unit].filter(Boolean).join(' / ') : '';
                const isHighlight = i === highlightIdx;
                return (
                  <div
                    key={p.id}
                    role="option"
                    aria-selected={isHighlight}
                    onMouseEnter={() => setHighlightIdx(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectProduct(p);
                    }}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--noorix-border)' : 'none',
                      background: isHighlight ? 'var(--noorix-bg-muted)' : 'transparent',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    <span style={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.nameAr || p.nameEn || p.id}
                    </span>
                    {(variantLabel || lastPrice > 0) && (
                      <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {variantLabel && <span>{variantLabel} — </span>}
                        <span style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(lastPrice, 2)} ﷼</span>
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
