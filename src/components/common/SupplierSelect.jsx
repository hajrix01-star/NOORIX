/**
 * SupplierSelect — اختيار مورد مع بحث سريع
 */
import React, { useEffect, useMemo, useState } from 'react';

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

export function SupplierSelect({ suppliers = [], value, onChange, bookmarkedIds = [], placeholder = '—' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === value) || null,
    [suppliers, value],
  );

  useEffect(() => {
    setQuery(selectedSupplier ? supplierLabel(selectedSupplier) : '');
  }, [selectedSupplier]);

  const filteredSuppliers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const bookmarked = new Set(bookmarkedIds);
    const list = [...suppliers].sort((a, b) => {
      const aBookmarked = bookmarked.has(a.id) ? 1 : 0;
      const bBookmarked = bookmarked.has(b.id) ? 1 : 0;
      if (aBookmarked !== bBookmarked) return bBookmarked - aBookmarked;
      return supplierLabel(a).localeCompare(supplierLabel(b), 'ar');
    });
    if (!normalized) return list.slice(0, 40);
    return list.filter((s) => {
      const nameAr = String(s.nameAr || '').toLowerCase();
      const nameEn = String(s.nameEn || '').toLowerCase();
      const code = String(s.code || '').toLowerCase();
      return nameAr.includes(normalized) || nameEn.includes(normalized) || code.includes(normalized);
    }).slice(0, 40);
  }, [bookmarkedIds, query, suppliers]);

  const showMenu = open && (filteredSuppliers.length > 0 || query.trim());

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
          {filteredSuppliers.length > 0 ? filteredSuppliers.map((s) => {
            const isSelected = s.id === value;
            const isBookmarked = bookmarkedIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s.id);
                  setQuery(supplierLabel(s));
                  setOpen(false);
                }}
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
