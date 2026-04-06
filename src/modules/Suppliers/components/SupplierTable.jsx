/**
 * SupplierTable — جدول عرض الموردين مع تحديد متعدد وحذف جماعي.
 * Props: suppliers, flatCategories, onEdit, onDelete,
 *        selectedIds (Set), onSelectChange(id,bool), onSelectAll(bool),
 *        onBulkDelete
 */
import React, { memo, useState, useEffect } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Badge, Button } from '../../../ui';

const sName = (s, lang) => (lang === 'en' ? s?.nameEn || s?.nameAr : s?.nameAr || s?.nameEn) || '—';

/* ── بادج نوع المورد ── */
function TypeBadge({ type }) {
  const colorMap = {
    purchase:  'blue',
    purchases: 'blue',
    expense:   'amber',
    expenses:  'amber',
  };
  const labelMap = {
    purchase:  'categoryTypes',
    purchases: 'categoryTypes',
    expense:   'categoryTypeExpense',
    expenses:  'categoryTypeExpense',
  };
  const { t } = useTranslation();
  const color = colorMap[type] || 'gray';
  const labelKey = labelMap[type];
  return (
    <Badge color={color} size="sm">
      {labelKey ? t(labelKey) : type}
    </Badge>
  );
}

/* ── checkbox مُنسَّق ── */
function CB({ checked, indeterminate, onChange, ariaLabel }) {
  return (
    <label className="nx-checkbox" style={{ justifyContent: 'center', minHeight: 36, minWidth: 36, padding: 4 }}>
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => { if (el) el.indeterminate = !!indeterminate; }}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
        style={{ width: 16, height: 16, accentColor: 'var(--noorix-accent-green)', cursor: 'pointer' }}
      />
    </label>
  );
}

/* ── أزرار الإجراء ── */
function ActionBtns({ onEdit, onDelete, t }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
      <Button size="sm" onClick={onEdit}>✎ {t('edit')}</Button>
      <Button size="sm" variant="danger" onClick={onDelete}>× {t('delete')}</Button>
    </div>
  );
}

export const SupplierTable = memo(function SupplierTable({
  suppliers = [],
  flatCategories = [],
  onEdit,
  onDelete,
  selectedIds = new Set(),
  onSelectChange,
  onSelectAll,
  onBulkDelete,
}) {
  const { t, lang } = useTranslation();

  const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 700px)') : null;
  const [isMobile, setIsMobile] = useState(mq?.matches ?? false);
  useEffect(() => {
    if (!mq) return;
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allSelected    = suppliers.length > 0 && selectedIds.size === suppliers.length;
  const someSelected   = selectedIds.size > 0 && !allSelected;
  const hasSelection   = selectedIds.size > 0;

  if (suppliers.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--noorix-text-muted)', border: '2px dashed var(--noorix-border)', borderRadius: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 8, color: 'var(--noorix-text-muted)' }}>—</div>
        <p style={{ margin: 0, fontSize: 13 }}>{t('noSuppliers')}</p>
      </div>
    );
  }

  /* ── شريط الحذف الجماعي ── */
  const BulkBar = hasSelection ? (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
      background: 'rgba(239,68,68,0.07)', borderBottom: '1px solid rgba(239,68,68,0.2)',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--noorix-accent-red)', flex: 1 }}>
        تم تحديد {selectedIds.size} {selectedIds.size === 1 ? 'مورد' : 'موردين'}
      </span>
      <Button variant="danger" onClick={() => onBulkDelete?.()}>حذف المحددين</Button>
      <Button onClick={() => onSelectAll?.(false)}>إلغاء التحديد</Button>
    </div>
  ) : null;

  /* ══════════════════ عرض الجوال ══════════════════ */
  if (isMobile) {
    return (
      <div className="noorix-surface-card" style={{ overflow: 'hidden' }}>
        {/* رأس: عدد + تحديد الكل */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--noorix-border)' }}>
          <CB
            checked={allSelected}
            indeterminate={someSelected}
            onChange={(v) => onSelectAll?.(v)}
            ariaLabel="تحديد الكل"
          />
          <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', flex: 1 }}>
            {t('supplierCount', suppliers.length)}
          </span>
        </div>

        {BulkBar}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {suppliers.map((s) => {
            const cat = flatCategories.find((c) => c.id === s.supplierCategoryId);
            const icon = cat?.icon || cat?.account?.icon || '';
            const checked = selectedIds.has(s.id);
            return (
              <div
                key={s.id}
                style={{ padding: '12px 16px', borderBottom: '1px solid var(--noorix-border)', background: checked ? 'rgba(22,163,74,0.04)' : 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {/* checkbox */}
                  <CB checked={checked} onChange={(v) => onSelectChange?.(s.id, v)} ariaLabel={`تحديد ${s.nameAr}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{sName(s, lang)}</div>
                        {s.nameEn && s.nameAr && lang !== 'en' && <div className="nx-cell-muted">{s.nameEn}</div>}
                        {s.nameAr && lang === 'en' && <div className="nx-cell-muted">{s.nameAr}</div>}
                      </div>
                      <TypeBadge type={s.supplierType || 'purchases'} />
                    </div>
                    {(s.phone || s.taxNumber) && (
                      <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                        {s.phone && <span>{s.phone}</span>}
                        {s.taxNumber && <span className="nx-cell-num">{s.taxNumber}</span>}
                      </div>
                    )}
                    {cat && (
                      <div style={{ marginBottom: 8 }}>
                        <Badge color={cat.type === 'purchase' ? 'blue' : 'amber'} size="sm">
                          {icon && <span>{icon}</span>}{cat.nameAr}
                        </Badge>
                      </div>
                    )}
                    <ActionBtns onEdit={() => onEdit?.(s)} onDelete={() => onDelete?.(s)} t={t} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ══════════════════ عرض الديسكتوب ══════════════════ */
  const headers = [
    { label: '', width: 40 },
    { label: t('name') },
    { label: t('nameEnCol') },
    { label: t('taxNumber') },
    { label: t('phone') },
    { label: t('category') },
    { label: t('type') },
    { label: t('actions') },
  ];

  return (
    <div className="noorix-surface-card noorix-table-frame" style={{ overflow: 'hidden' }}>
      {/* رأس: عدد */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--noorix-border)', fontSize: 12, color: 'var(--noorix-text-muted)' }}>
        <span style={{ flex: 1 }}>{t('supplierCount', suppliers.length)}</span>
      </div>

      {BulkBar}

      <div style={{ overflowX: 'auto' }}>
        <table className="noorix-table" style={{ minWidth: 560 }}>
          <thead>
            <tr style={{ textAlign: 'right' }}>
              {/* عمود التحديد */}
              <th style={{ padding: '9px 4px 9px 12px', width: 40 }}>
                <CB
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(v) => onSelectAll?.(v)}
                  ariaLabel="تحديد الكل"
                />
              </th>
              {headers.slice(1).map((h) => (
                <th key={h.label} style={{ padding: '9px 12px', fontWeight: 700, fontSize: 12 }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => {
              const cat     = flatCategories.find((c) => c.id === s.supplierCategoryId);
              const icon    = cat?.icon || cat?.account?.icon || '';
              const checked = selectedIds.has(s.id);
              return (
                <tr
                  key={s.id}
                  style={{ background: checked ? 'rgba(22,163,74,0.04)' : 'transparent' }}
                >
                  <td style={{ padding: '4px 4px 4px 12px' }}>
                    <CB checked={checked} onChange={(v) => onSelectChange?.(s.id, v)} ariaLabel={`تحديد ${s.nameAr}`} />
                  </td>
                  <td style={{ padding: '9px 12px', fontWeight: 700 }}>{sName(s, lang)}</td>
                  <td style={{ padding: '9px 12px' }} className="nx-cell-muted">{lang === 'en' ? (s.nameAr || '—') : (s.nameEn || '—')}</td>
                  <td style={{ padding: '9px 12px' }} className="nx-cell-num">{s.taxNumber || '—'}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12 }}>{s.phone || '—'}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12 }}>
                    {cat ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
                        <Badge color={cat.type === 'purchase' ? 'blue' : 'amber'} size="sm">
                          {cat.nameAr}
                          {cat.account?.code && <span style={{ marginRight: 4, opacity: 0.7 }}>[{cat.account.code}]</span>}
                        </Badge>
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <TypeBadge type={s.supplierType || 'purchases'} />
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <ActionBtns onEdit={() => onEdit?.(s)} onDelete={() => onDelete?.(s)} t={t} />
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
