/**
 * SupplierSelect — قائمة منسدلة لاختيار المورد
 */
import React from 'react';

export function SupplierSelect({ suppliers = [], value, onChange, bookmarkedIds = [], placeholder = '—' }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || '')}
      style={{
        width: '100%',
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px solid var(--noorix-border)',
        background: 'var(--noorix-bg-surface)',
        color: 'var(--noorix-text)',
        fontSize: 14,
        fontFamily: 'inherit',
      }}
    >
      <option value="">{placeholder}</option>
      {suppliers.map((s) => (
        <option key={s.id} value={s.id}>
          {s.nameAr || s.nameEn || s.id}
        </option>
      ))}
    </select>
  );
}
