/**
 * SupplierSelect — اختيار مورد مع بحث سريع وأعلى الموردين استخداماً
 */
import React, { useEffect, useMemo, useState } from 'react';

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
    // Ignore storage errors and keep the picker usable.
  }
}

export function SupplierSelect({ suppliers = [], value, onChange, bookmarkedIds = [], placeholder = '—' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [usageVersion, setUsageVersion] = useState(0);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === value) || null,
    [suppliers, value],
  );

  useEffect(() => {
    setQuery(selectedSupplier ? supplierLabel(selectedSupplier) : '');
  }, [selectedSupplier]);

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
    () => query.trim() ? [] : filteredSuppliers.filter((s) => Number(readSupplierUsage()[s.id] || 0) > 0).slice(0, 6),
    [filteredSuppliers, query, usageVersion],
  );

  const remainingSuppliers = useMemo(() => {
    if (!topSuppliers.length) return filteredSuppliers;
    const topIds = new Set(topSuppliers.map((s) => s.id));
    return filteredSuppliers.filter((s) => !topIds.has(s.id));
  }, [filteredSuppliers, topSuppliers]);

  const showMenu = open && (filteredSuppliers.length > 0 || query.trim());

  function selectSupplier(supplier) {
    onChange(supplier.id);
    setQuery(supplierLabel(supplier));
    setOpen(false);
    trackSupplierUsage(supplier.id);
    setUsageVersion((v) => v + 1);
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (!next.trim() && value) onChange('');
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        style={INPUT_STYLE}
      />
      {showMenu && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            insetInlineStart: 0,
            insetInlineEnd: 0,
            maxHeight: 260,
            overflowY: 'auto',
            borderRadius: 10,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            zIndex: 40,
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
                  <span style={{ color: '#2563eb', fontSize: 11 }}>الاكثر</span>
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
              لا يوجد مورد مطابق
            </div>
          )}
        </div>
      )}
    </div>
  );
}
