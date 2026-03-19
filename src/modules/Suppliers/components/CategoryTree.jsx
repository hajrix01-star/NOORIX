/**
 * CategoryTree — شجرة التصنيفات (أم + فرعية) مع تعديل/حذف/إضافة سريعة.
 * Props: categories, companyId, onCreate, onUpdate, onDelete
 */
import React, { useState, memo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCategory } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';

const IS = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
};

const TYPE_KEYS = { purchase: 'categoryTypes', expense: 'categoryTypeExpense', sale: 'categoryTypeSale', general: 'categoryTypeGeneral' };
const TYPE_STYLES = {
  purchase: { bg: 'rgba(37,99,235,0.08)', color: '#2563eb' },
  expense:  { bg: 'rgba(217,119,6,0.08)', color: '#d97706' },
  sale:     { bg: 'rgba(22,163,74,0.08)', color: '#16a34a' },
  general:  { bg: 'rgba(100,116,139,0.08)', color: '#64748b' },
};

function TypeBadge({ type, t }) {
  const c = TYPE_STYLES[type] || TYPE_STYLES.general;
  const label = TYPE_KEYS[type] ? t(TYPE_KEYS[type]) : type;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>
      {label}
    </span>
  );
}

// ── إضافة فرعية سريعة ──────────────────────────────────────────
const QuickAddChild = memo(function QuickAddChild({ companyId, parentId, parentType, onSuccess, t }) {
  const queryClient = useQueryClient();
  const [show, setShow]   = useState(false);
  const [name, setName]   = useState('');

  const addMut = useMutation({
    mutationFn: (body) => createCategory(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', companyId] });
      onSuccess?.(t('subcategoryAdded'));
      setName('');
      setShow(false);
    },
  });

  if (!show) {
    return (
      <button
        type="button"
        style={{ width: '100%', padding: '7px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--noorix-text-muted)', textAlign: 'right' }}
        onClick={() => setShow(true)}
      >
        {t('addSubcategory')}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6, padding: '8px 16px', alignItems: 'center' }}>
      <input
        autoFocus value={name} onChange={(e) => setName(e.target.value)}
        placeholder={t('subcategoryNamePlaceholder')} style={{ ...IS, flex: 1 }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) addMut.mutate({ companyId, nameAr: name.trim(), parentId, type: parentType });
        }}
      />
      <button
        type="button" className="noorix-btn-nav noorix-btn-success"
        style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}
        disabled={!name.trim() || addMut.isPending}
        onClick={() => addMut.mutate({ companyId, nameAr: name.trim(), parentId, type: parentType })}
      >
        {t('add')}
      </button>
      <button type="button" className="noorix-btn-nav" style={{ padding: '5px 10px' }} onClick={() => setShow(false)}>{t('cancel')}</button>
    </div>
  );
});

// ── الشجرة الرئيسية ─────────────────────────────────────────────
export const CategoryTree = memo(function CategoryTree({
  categories = [],
  companyId,
  onUpdate,
  onDelete,
  onToast,
  isLoading,
}) {
  const { t } = useTranslation();
  const [editCat, setEditCat] = useState(null);
  const [expanded, setExpanded] = useState({});
  const CATEGORY_TYPES = [
    { value: 'purchase', labelKey: 'categoryTypes' },
    { value: 'expense',  labelKey: 'categoryTypeExpense' },
    { value: 'sale',     labelKey: 'categoryTypeSale' },
    { value: 'general',  labelKey: 'categoryTypeGeneral' },
  ];

  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  function startEdit(cat) {
    setEditCat({ id: cat.id, nameAr: cat.nameAr, nameEn: cat.nameEn || '', type: cat.type, icon: cat.icon || '' });
  }

  function saveEdit() {
    if (!editCat?.nameAr.trim()) return;
    onUpdate({ id: editCat.id, body: { nameAr: editCat.nameAr, nameEn: editCat.nameEn, type: editCat.type, icon: editCat.icon, companyId } });
    setEditCat(null);
  }

  if (isLoading) {
    return <p style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>{t('loading')}</p>;
  }

  if (categories.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--noorix-text-muted)', border: '2px dashed var(--noorix-border)', borderRadius: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🗂️</div>
        <p style={{ margin: 0, fontSize: 13 }}>{t('noCategories')}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {categories.map((parent) => (
        <div key={parent.id} className="noorix-surface-card" style={{ borderRadius: 12, overflow: 'hidden' }}>
          {/* صف الفئة الأم */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: parent.children?.length > 0 ? 'pointer' : 'default' }}
            onClick={() => parent.children?.length > 0 && toggle(parent.id)}
          >
            <span style={{ fontSize: 20 }}>{parent.icon || parent.account?.icon || '📁'}</span>
            <div style={{ flex: 1 }}>
              {editCat?.id === parent.id ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input value={editCat.nameAr} onChange={(e) => setEditCat((p) => ({ ...p, nameAr: e.target.value }))} style={{ ...IS, width: 160 }} />
                  <select value={editCat.type} onChange={(e) => setEditCat((p) => ({ ...p, type: e.target.value }))} style={{ ...IS, width: 110 }}>
                    {CATEGORY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <button type="button" className="noorix-btn-nav noorix-btn-success" style={{ padding: '5px 10px' }} onClick={saveEdit}>حفظ</button>
                  <button type="button" className="noorix-btn-nav" style={{ padding: '5px 10px' }} onClick={() => setEditCat(null)}>إلغاء</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{parent.nameAr}</span>
                  {parent.account?.code && (
                    <span style={{ fontSize: 11, color: 'var(--noorix-text-muted)', padding: '1px 6px', background: 'var(--noorix-bg-page)', borderRadius: 6 }}>[{parent.account.code}]</span>
                  )}
                  {parent.account?.taxExempt && (
                    <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>{t('taxExempt')}</span>
                  )}
                  {parent.nameEn && <span style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{parent.nameEn}</span>}
                  <TypeBadge type={parent.type} t={t} />
                  {parent.children?.length > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('subcategoriesCount', parent.children.length)}</span>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {editCat?.id !== parent.id && (
                <button type="button" className="noorix-btn-nav" style={{ padding: '5px 10px' }} onClick={(e) => { e.stopPropagation(); startEdit(parent); }}>{t('edit')}</button>
              )}
              <button type="button" className="noorix-btn-nav noorix-btn-danger" style={{ padding: '5px 10px' }} onClick={(e) => { e.stopPropagation(); onDelete(parent.id); }}>{t('delete')}</button>
              {parent.children?.length > 0 && (
                <span style={{ fontSize: 14, color: 'var(--noorix-text-muted)' }}>{expanded[parent.id] ? '▲' : '▼'}</span>
              )}
            </div>
          </div>

          {/* الفئات الفرعية */}
          {(expanded[parent.id] || !parent.children?.length) && parent.children?.length > 0 && (
            <div style={{ borderTop: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-page)' }}>
              {parent.children.map((child) => (
                <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px 9px 32px', borderBottom: '1px solid var(--noorix-border)' }}>
                  <span style={{ fontSize: 14 }}>{child.icon || child.account?.icon || '📄'}</span>
                  <div style={{ flex: 1 }}>
                    {editCat?.id === child.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input value={editCat.nameAr} onChange={(e) => setEditCat((p) => ({ ...p, nameAr: e.target.value }))} style={{ ...IS, width: 150 }} />
                        <button type="button" className="noorix-btn-nav noorix-btn-success" style={{ padding: '5px 10px' }} onClick={saveEdit}>{t('save')}</button>
                        <button type="button" className="noorix-btn-nav" style={{ padding: '5px 10px' }} onClick={() => setEditCat(null)}>{t('cancel')}</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13 }}>↳</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{child.nameAr}</span>
                        {child.account?.code && (
                          <span style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>[{child.account.code}]</span>
                        )}
                        {child.nameEn && <span style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{child.nameEn}</span>}
                        <TypeBadge type={child.type} t={t} />
                      </div>
                    )}
                  </div>
                  {editCat?.id !== child.id && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" className="noorix-btn-nav" style={{ padding: '5px 10px' }} onClick={() => startEdit(child)}>{t('edit')}</button>
                      <button type="button" className="noorix-btn-nav noorix-btn-danger" style={{ padding: '5px 10px' }} onClick={() => onDelete(child.id)}>{t('delete')}</button>
                    </div>
                  )}
                </div>
              ))}
              <QuickAddChild companyId={companyId} parentId={parent.id} parentType={parent.type} onSuccess={onToast} t={t} />
            </div>
          )}

          {/* زر إضافة فرعية عندما لا توجد أبناء */}
          {!parent.children?.length && (
            <div style={{ borderTop: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-page)' }}>
              <QuickAddChild companyId={companyId} parentId={parent.id} parentType={parent.type} onSuccess={onToast} t={t} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

export default CategoryTree;
