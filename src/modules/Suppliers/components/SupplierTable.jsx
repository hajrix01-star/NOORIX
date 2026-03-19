/**
 * SupplierTable — جدول عرض الموردين.
 * Props: suppliers, flatCategories, onEdit, onDelete
 */
import React, { memo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';

function TypeBadge({ type, t }) {
  const labels = { purchase: 'categoryTypes', purchases: 'categoryTypes', expense: 'categoryTypeExpense', expenses: 'categoryTypeExpense' };
  const c = { purchase: { bg: 'rgba(37,99,235,0.08)', color: '#2563eb' }, purchases: { bg: 'rgba(37,99,235,0.08)', color: '#2563eb' }, expense: { bg: 'rgba(217,119,6,0.08)', color: '#d97706' }, expenses: { bg: 'rgba(217,119,6,0.08)', color: '#d97706' } }[type] || { bg: 'rgba(100,116,139,0.08)', color: '#64748b' };
  const label = labels[type] ? t(labels[type]) : type;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>
      {label}
    </span>
  );
}

export const SupplierTable = memo(function SupplierTable({ suppliers = [], flatCategories = [], onEdit, onDelete }) {
  const { t } = useTranslation();
  const headers = [t('name'), t('nameEnCol'), t('taxNumber'), t('phone'), t('category'), t('type'), t('actions')];

  if (suppliers.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--noorix-text-muted)', border: '2px dashed var(--noorix-border)', borderRadius: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏪</div>
        <p style={{ margin: 0, fontSize: 13 }}>{t('noSuppliers')}</p>
      </div>
    );
  }

  return (
    <div className="noorix-surface-card noorix-table-frame" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--noorix-border)', fontSize: 12, color: 'var(--noorix-text-muted)' }}>
        {t('supplierCount', suppliers.length)}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="noorix-table" style={{ minWidth: 500 }}>
          <thead>
            <tr style={{ textAlign: 'right' }}>
              {headers.map((h) => (
                <th key={h} style={{ padding: '9px 12px', fontWeight: 700, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s, i) => {
              const cat = flatCategories.find((c) => c.id === s.supplierCategoryId);
              const icon = cat?.icon || cat?.account?.icon || '';
              return (
                <tr key={s.id}>
                  <td style={{ padding: '9px 12px', fontWeight: 700 }}>{s.nameAr}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--noorix-text-muted)', fontSize: 12 }}>{s.nameEn || '—'}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{s.taxNumber || '—'}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12 }}>{s.phone || '—'}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12 }}>
                    {cat ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: cat.type === 'purchase' ? 'rgba(37,99,235,0.08)' : 'rgba(217,119,6,0.08)', color: cat.type === 'purchase' ? '#2563eb' : '#d97706' }}>
                          {cat.nameAr}
                          {cat.account?.code && <span style={{ marginRight: 4, opacity: 0.8 }}>[{cat.account.code}]</span>}
                        </span>
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <TypeBadge type={s.supplierType || s.categoryId || 'purchases'} t={t} />
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <div className="noorix-actions-row" style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => onEdit?.(s)}
                        title={t('edit')}
                        style={{
                          padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                          border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
                          color: 'var(--noorix-text)',
                        }}
                      >
                        ✎ {t('edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete?.(s)}
                        title={t('delete')}
                        style={{
                          padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                          border: '1px solid #fecaca', background: 'rgba(239,68,68,0.06)', color: '#dc2626',
                        }}
                      >
                        × {t('delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default SupplierTable;
