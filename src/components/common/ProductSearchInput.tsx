/**
 * ProductSearchInput — بحث ذكي عن الصنف (عربي + إنجليزي)
 * يعرض الحجم والسعر من آخر طلب (lastPrice من variants)
 * يستخدم Portal للقائمة المنسدلة لتجنب القص (overflow)
 * يدعم debounce 300ms، loading state، RTL، وجوال (font-size ≥ 16px)
 */
import React, { useState, useRef, useEffect, useMemo, type ChangeEvent, type CSSProperties } from 'react';
import { useDebouncedValue } from '../../ui';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { fmt } from '../../utils/format';
import { FloatingPanel, Input } from '../../ui';

type ProductVariant = {
  size?: string;
  packaging?: string;
  unit?: string;
  lastPrice?: string | number;
};

export type ProductSearchItem = {
  id: string;
  nameAr?: string;
  nameEn?: string;
  lastPrice?: string | number;
  variants?: ProductVariant[];
};

export type ProductSearchInputProps = {
  products?: ProductSearchItem[];
  productsById?: Map<string, ProductSearchItem>;
  value?: string;
  onChange?: (id: string) => void;
  onSelectProduct?: (payload: {
    productId: string;
    variantKey: string;
    size: string;
    packaging: string;
    unit: string;
    unitPrice: string;
  }) => void;
  placeholder?: string;
  style?: CSSProperties;
  compact?: boolean;
  loading?: boolean;
};

type DropdownRect = { top: number; left: number; width: number };

/** تطبيع النص للبحث (إزالة التشكيل، توحيد المسافات) */
function normalizeForSearch(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** فحص تطابق البحث — عربي أو إنجليزي */
function matchesSearch(product: ProductSearchItem, searchNorm: string): boolean {
  if (!searchNorm) return true;
  const ar = normalizeForSearch(product.nameAr || '');
  const en = normalizeForSearch(product.nameEn || '');
  return ar.includes(searchNorm) || en.includes(searchNorm);
}

export function ProductSearchInput({
  products = [],
  productsById,
  value,
  onChange,
  onSelectProduct,
  placeholder = '— اختر الصنف —',
  style = {},
  compact = false,
  loading = false,
}: ProductSearchInputProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [dropdownRect, setDropdownRect] = useState<DropdownRect | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedProduct = value ? productsById?.get(value) : null;
  const displayValue = selectedProduct ? selectedProduct.nameAr || selectedProduct.nameEn || '' : '';

  const filtered = useMemo(() => {
    const q = normalizeForSearch(debouncedQuery);
    if (!q) return products;
    return products.filter((p: any) => matchesSearch(p, q));
  }, [products, debouncedQuery]);

  function updateDropdownPosition() {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const isRtl = document.documentElement.dir === 'rtl';
    const minW = 320;
    const maxW = window.innerWidth - 24;
    const w = Math.min(Math.max(rect.width, minW), maxW);
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
    function handleClickOutside(e: Event) {
      if (!containerRef.current) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (containerRef.current.contains(target)) return;
      if ((target as Element).closest?.('[data-product-search-dropdown]')) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectProduct(p: ProductSearchItem) {
    const variants = Array.isArray(p?.variants) ? p.variants : [];
    const first = variants[0];
    onChange?.(p.id);
    onSelectProduct?.({
      productId: p.id,
      variantKey: first ? `${first.size || ''}|${first.packaging || ''}|${first.unit || ''}|0` : '',
      size: first?.size || '',
      packaging: first?.packaging || '',
      unit: first?.unit || 'piece',
      unitPrice: first?.lastPrice ? String(first.lastPrice) : p?.lastPrice ? String(p.lastPrice) : '',
    });
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      setHighlightIdx((i: any) => Math.min(i + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setHighlightIdx((i: any) => Math.max(i - 1, 0));
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

  return (
    <div ref={containerRef} className="relative" style={style}>
      <Input
        ref={inputRef}
        type="text"
        value={open ? query : displayValue}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const val = e.target.value;
          setQuery(val);
          setOpen(true);
          if (value) onChange?.('');
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={compact ? 'py-1.5 px-2.5 min-h-9 text-[14px]' : undefined}
      />
      {open &&
        dropdownRect &&
        createPortal(
          <FloatingPanel
            data-product-search-dropdown
            className="overflow-y-auto overflow-x-hidden rounded-lg bg-noorix-surface border border-noorix-border"
            top={dropdownRect.top}
            left={dropdownRect.left}
            width={dropdownRect.width}
            maxHeight={280}
            zIndex={10001}
            boxShadow="0 8px 24px rgba(0,0,0,0.12)"
          >
            {loading ? (
              <div className="p-4 text-noorix-muted text-[13px] text-center flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full shrink-0 border-2 border-noorix-border border-t-noorix-blue animate-[noorix-spin_0.8s_linear_infinite]" />
                {t('loading') || 'جاري التحميل...'}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-noorix-muted text-[13px] text-center">
                {t('ordersNoSearchResults') || 'لا توجد نتائج'}
              </div>
            ) : (
              filtered.map((p: any, i: any) => {
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
                    onMouseDown={(ev: any) => {
                      ev.preventDefault();
                      selectProduct(p);
                    }}
                    className={`nx-product-search-option py-[10px] px-[14px] cursor-pointer flex justify-between items-center gap-3 flex-nowrap min-w-0${isHighlight ? ' nx-product-search-option--highlight' : ''}`}
                  >
                    <span className="font-medium flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                      {p.nameAr || p.nameEn || p.id}
                    </span>
                    {(variantLabel || Number(lastPrice) > 0) && (
                      <span className="text-[12px] shrink-0 whitespace-nowrap text-noorix-muted">
                        {variantLabel && <span>{variantLabel} — </span>}
                        <span className="nx-font-numbers">{fmt(lastPrice)} SR</span>
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </FloatingPanel>,
          document.body,
        )}
    </div>
  );
}
