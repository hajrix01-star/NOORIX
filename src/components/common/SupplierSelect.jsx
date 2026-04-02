/**
 * SupplierSelect — بحث + قائمة منسدلة تُعرض عبر Portal لتجاوز overflow:hidden في جداول ERP
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

const USAGE_STORAGE_KEY = 'noorix_supplier_usage_v1';

const INPUT_STYLE = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--noorix-border)',
  background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

function supplierLabel(supplier) {
  return supplier?.nameAr || supplier?.nameEn || supplier?.id || '';
}

function readSupplierUsage() {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function trackSupplierUsage(supplierId) {
  if (!supplierId) return;
  try {
    const usage = readSupplierUsage();
    usage[supplierId] = Number(usage[supplierId] || 0) + 1;
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // ignore
  }
}

export function SupplierSelect({ suppliers = [], value, onChange, bookmarkedIds = [], placeholder = '—' }) {
  const anchorRef = useRef(null);
  const menuRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [usageVersion, setUsageVersion] = useState(0);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 280, maxHeight: 260 });

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === value) || null,
    [suppliers, value],
  );

  useEffect(() => {
    if (!open) {
      setQuery(selectedSupplier ? supplierLabel(selectedSupplier) : '');
    }
  }, [selectedSupplier, open]);

  const filteredSuppliers = useMemo(() => {
    const usage = readSupplierUsage();
    const normalized = query.trim().toLowerCase();
    const bookmarked = new Set(bookmarkedIds);
    const list = [...suppliers].sort((a, b) => {
      const aBookmarked = bookmarked.has(a.id) ? 1 : 0;
      const bBookmarked = bookmarked.has(b.id) ? 1 : 0;
      if (aBookmarked !== bBookmarked) return bBookmarked - aBookmarked;
      const aUsage = Number(usage[a.id] || 0);
      const bUsage = Number(usage[b.id] || 0);
      if (aUsage !== bUsage) return bUsage - aUsage;
      return supplierLabel(a).localeCompare(supplierLabel(b), 'ar');
    });
    if (!normalized) return list.slice(0, 40);
    return list.filter((s) => {
      const nameAr = String(s.nameAr || '').toLowerCase();
      const nameEn = String(s.nameEn || '').toLowerCase();
      const code = String(s.code || '').toLowerCase();
      return nameAr.includes(normalized) || nameEn.includes(normalized) || code.includes(normalized);
    }).slice(0, 40);
  }, [bookmarkedIds, query, suppliers, usageVersion]);

  const topSuppliers = useMemo(
    () => (query.trim() ? [] : filteredSuppliers.filter((s) => Number(readSupplierUsage()[s.id] || 0) > 0).slice(0, 6)),
    [filteredSuppliers, query, usageVersion],
  );

  const remainingSuppliers = useMemo(() => {
    if (!topSuppliers.length) return filteredSuppliers;
    const topIds = new Set(topSuppliers.map((s) => s.id));
    return filteredSuppliers.filter((s) => !topIds.has(s.id));
  }, [filteredSuppliers, topSuppliers]);

  const updateMenuPosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxH = 260;
    const gap = 4;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const spaceBelow = vh - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUpward = spaceBelow < 140 && spaceAbove > spaceBelow;
    const width = Math.min(Math.max(rect.width, 220), vw - 16);
    let left = rect.left;
    if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
    let top;
    let effectiveMaxH = maxH;
    if (openUpward) {
      effectiveMaxH = Math.min(maxH, spaceAbove - 8);
      top = rect.top - gap - effectiveMaxH;
      if (top < 8) {
        top = 8;
        effectiveMaxH = Math.min(maxH, rect.top - gap - 8);
      }
    } else {
      top = rect.bottom + gap;
      effectiveMaxH = Math.min(maxH, spaceBelow - 8);
    }
    setMenuPos({ top, left, width, maxHeight: Math.max(120, effectiveMaxH) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const onScroll = () => updateMenuPosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updateMenuPosition, query, filteredSuppliers.length, usageVersion]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const a = anchorRef.current;
      const m = menuRef.current;
      if (a?.contains(e.target) || m?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const showMenu = open && (filteredSuppliers.length > 0 || query.trim() || suppliers.length > 0);

  function selectSupplier(supplier) {
    onChange(supplier.id);
    setQuery(supplierLabel(supplier));
    setOpen(false);
    trackSupplierUsage(supplier.id);
    setUsageVersion((v) => v + 1);
  }

  const ph = placeholder && placeholder !== '—' ? placeholder : 'ابحث عن المورد أو اختره';

  const menuContent = showMenu && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={{
            position: 'fixed',
            zIndex: 10060,
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: menuPos.maxHeight,
            overflowY: 'auto',
            borderRadius: 10,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          }}
        >
          {topSuppliers.length > 0 && (
            <div style={{ padding: '8px 12px 6px', fontSize: 11, fontWeight: 700, color: 'var(--noorix-text-muted)', background: 'var(--noorix-bg-page)', borderBottom: '1px solid var(--noorix-border)' }}>
              الموردون الأكثر طلباً
            </div>
          )}
          {topSuppliers.map((s) => {
            const isSelected = s.id === value;
            const isBookmarked = bookmarkedIds.includes(s.id);
            return (
              <button
                key={`top-${s.id}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSupplier(s)}
                style={{
                  width: '100%',
                  textAlign: 'right',
                  padding: '9px 12px',
                  border: 'none',
                  borderBottom: '1px solid var(--noorix-border)',
                  background: isSelected ? 'rgba(37,99,235,0.08)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {supplierLabel(s)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {isBookmarked ? <span style={{ color: '#f59e0b' }}>★</span> : null}
                  <span style={{ color: '#2563eb', fontSize: 11 }}>الأكثر</span>
                </span>
              </button>
            );
          })}
          {topSuppliers.length > 0 && remainingSuppliers.length > 0 && (
            <div style={{ padding: '8px 12px 6px', fontSize: 11, fontWeight: 700, color: 'var(--noorix-text-muted)', background: 'var(--noorix-bg-page)', borderBottom: '1px solid var(--noorix-border)' }}>
              جميع الموردين
            </div>
          )}
          {filteredSuppliers.length > 0 ? remainingSuppliers.map((s) => {
            const isSelected = s.id === value;
            const isBookmarked = bookmarkedIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSupplier(s)}
                style={{
                  width: '100%',
                  textAlign: 'right',
                  padding: '9px 12px',
                  border: 'none',
                  borderBottom: '1px solid var(--noorix-border)',
                  background: isSelected ? 'rgba(37,99,235,0.08)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {supplierLabel(s)}
                </span>
                {isBookmarked ? <span style={{ color: '#f59e0b', flexShrink: 0 }}>★</span> : null}
              </button>
            );
          }) : (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--noorix-text-muted)' }}>
              {suppliers.length ? 'لا يوجد مورد مطابق' : 'لا يوجد موردون متاحون حالياً'}
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div style={{ position: 'relative' }} ref={anchorRef}>
      <input
        value={query}
        onFocus={() => { setOpen(true); }}
        onClick={() => { setOpen(true); }}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (!next.trim() && value) onChange('');
        }}
        placeholder={ph}
        autoComplete="off"
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{ ...INPUT_STYLE, paddingInlineEnd: 36 }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          insetInlineEnd: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--noorix-text-muted)',
          fontSize: 12,
          pointerEvents: 'none',
        }}
      >
        ▼
      </span>
      {menuContent}
    </div>
  );
}
