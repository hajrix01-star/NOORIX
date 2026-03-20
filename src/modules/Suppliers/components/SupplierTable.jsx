/**
 * SupplierTable — جدول عرض الموردين.
 * Props: suppliers, flatCategories, onEdit, onDelete
 */
import React, { memo, useState, useEffect } from 'react';
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

  const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 700px)') : null;
  const [isMobile, setIsMobile] = useState(mq?.matches ?? false);
  useEffect(() => {
    if (!mq) return;
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (suppliers.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--noorix-text-muted)', border: '2px dashed var(--noorix-border)', borderRadius: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏪</div>
        <p style={{ margin: 0, fontSize: 13 }}>{t('noSuppliers')}</p>
      </div>
    );
  }

  const actionButtons = (s) => (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button type="button" onClick={() => onEdit?.(s)} style={{ padding: '7px 14px', fontSize: 13, minHeight: 36, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)' }}>
        ✎ {t('edit')}
      </button>
      <button type="button" onClick={() => onDelete?.(s)} style={{ padding: '7px 14px', fontSize: 13, minHeight: 36, borderRadius: 8, cursor: 'pointer', border: '1px solid #fecaca', background: 'rgba(239,68,68,0.06)', color: '#dc2626' }}>
        × {t('delete')}
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <div className="noorix-surface-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--noorix-border)', fontSize: 12, color: 'var(--noorix-text-muted)' }}>
          {t('supplierCount', suppliers.length)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {suppliers.map((s) => {
            const cat = flatCategories.find((c) => c.id === s.supplierCategoryId);
            const icon = cat?.icon || cat?.account?.icon || '';
            return (
              <div key={s.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--noorix-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.nameAr}</div>
                    {s.nameEn && <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{s.nameEn}</div>}
                  </div>
                  <TypeBadge type={s.supplierType || 'purchases'} t={t} />
                </div>
                {(s.phone || s.taxNumber) && (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                    {s.phone && <span>{s.phone}</span>}
                    {s.taxNumber && <span style={{ fontFamily: 'monospace' }}>{s.taxNumber}</span>}
                  </div>
                )}
                {cat && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: cat.type === 'purchase' ? 'rgba(37,99,235,0.08)' : 'rgba(217,119,6,0.08)', color: cat.type === 'purchase' ? '#2563eb' : '#d97706' }}>
                      {icon && <span>{icon}</span>}
                      {cat.nameAr}
                    </span>
                  </div>
                )}
                {actionButtons(s)}
              </div>
            );
          })}
        </div>
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
            {suppliers.map((s) => {
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
                      <button type="button" onClick={() => onEdit?.(s)} title={t('edit')} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)' }}>
                        ✎ {t('edit')}
                      </button>
                      <button type="button" onClick={() => onDelete?.(s)} title={t('delete')} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: '1px solid #fecaca', background: 'rgba(239,68,68,0.06)', color: '#dc2626' }}>
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
