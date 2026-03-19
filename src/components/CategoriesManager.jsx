/**
 * CategoriesManager — مكون مشترك لإدارة التصنيفات (فئات الحسابات)
 * يُستخدم في: Suppliers/CategoriesTab (الموردين والتصنيفات)
 */
import React, { useState, useMemo, memo } from 'react';
import { useCategories } from '../hooks/useCategories';
import { useTranslation } from '../i18n/useTranslation';
import Toast from './Toast';
import SmartTable from './common/SmartTable';

const TYPE_MAP = {
  purchase: { bg: 'rgba(37,99,235,0.08)', color: '#2563eb', labelKey: 'categoryTypes' },
  expense: { bg: 'rgba(217,119,6,0.08)', color: '#d97706', labelKey: 'categoryTypeExpense' },
  sale: { bg: 'rgba(22,163,74,0.08)', color: '#16a34a', labelKey: 'categoryTypeSale' },
};

export const CategoriesManager = memo(function CategoriesManager({ companyId, titleKey = 'categoriesTab' }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [form, setForm] = useState({ nameAr: '', nameEn: '', type: 'purchase', icon: '📁', parentId: '' });

  const { categories, isLoading, create, update, remove } = useCategories(companyId);
  const roots = useMemo(() => categories.filter((c) => !c.parentId), [categories]);

  const handleParentChange = (parentId) => {
    const parent = roots.find((c) => c.id === parentId);
    setForm((p) => ({
      ...p,
      parentId: parentId || '',
      type: parent?.type || p.type,
    }));
  };

  const rows = useMemo(() => {
    const list = [];
    for (const cat of categories) {
      list.push({ ...cat, _level: 0 });
      for (const child of cat.children || []) {
        list.push({ ...child, _level: 1, _parentName: cat.nameAr });
      }
    }
    return list;
  }, [categories]);

  const typeStyles = useMemo(() => ({
    purchase: { bg: TYPE_MAP.purchase.bg, color: TYPE_MAP.purchase.color, label: t(TYPE_MAP.purchase.labelKey) },
    expense: { bg: TYPE_MAP.expense.bg, color: TYPE_MAP.expense.color, label: t(TYPE_MAP.expense.labelKey) },
    sale: { bg: TYPE_MAP.sale?.bg || TYPE_MAP.purchase.bg, color: TYPE_MAP.sale?.color || TYPE_MAP.purchase.color, label: t(TYPE_MAP.sale?.labelKey || 'categoryTypes') },
  }), [t]);

  function resetForm() {
    setForm({ nameAr: '', nameEn: '', type: 'purchase', icon: '📁', parentId: '' });
    setEditing(null);
    setShowForm(false);
  }

  function openEdit(cat) {
    setEditing(cat);
    setForm({ nameAr: cat.nameAr || '', nameEn: cat.nameEn || '', type: cat.type || 'purchase', icon: cat.icon || '📁', parentId: cat.parentId || '' });
    setShowForm(true);
  }

  function handleSave(e) {
    e?.preventDefault();
    if (!form.nameAr?.trim()) return;
    if (!companyId) {
      setToast({ visible: true, message: t('pleaseSelectCompanyFirst'), type: 'error' });
      return;
    }
    if (editing) {
      update.mutate(
        { id: editing.id, body: { companyId, nameAr: form.nameAr.trim(), nameEn: form.nameEn?.trim() || null, type: form.type, parentId: form.parentId || null, icon: form.icon || null } },
        { onSuccess: () => { setToast({ visible: true, message: t('updateSuccess'), type: 'success' }); resetForm(); }, onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }) },
      );
    } else {
      create.mutate(
        { companyId, nameAr: form.nameAr.trim(), nameEn: form.nameEn?.trim() || undefined, type: form.type, icon: form.icon || undefined, parentId: form.parentId || undefined, createAccount: true },
        { onSuccess: () => { setToast({ visible: true, message: t('categoryAdded'), type: 'success' }); resetForm(); }, onError: (e) => setToast({ visible: true, message: e?.message || t('addFailed'), type: 'error' }) },
      );
    }
  }

  function handleDelete(cat) {
    if (!confirm(t('deleteCategoryConfirm', cat.nameAr))) return;
    remove.mutate(cat.id, {
      onSuccess: () => setToast({ visible: true, message: t('categoryDeleted'), type: 'success' }),
      onError: (e) => setToast({ visible: true, message: e?.message || t('deleteFailed'), type: 'error' }),
    });
  }

  const columns = useMemo(() => [
    { key: 'nameAr', label: t('nameAr'), align: 'right', render: (v, row) => (
      <span
        style={{
          display: 'block',
          textAlign: 'right',
          fontWeight: row._level === 0 ? 700 : 500,
          paddingRight: row._level === 1 ? 32 : 0,
        }}
      >
        {row._level === 1 ? '↳ ' : ''}{(row.icon || '') + ' '}{v || '—'}
      </span>
    ) },
    { key: 'nameEn', label: t('nameEnCol'), render: (v) => <span style={{ color: 'var(--noorix-text-muted)', fontSize: 12 }}>{v || '—'}</span> },
    { key: 'type', label: t('type'), render: (v) => <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: typeStyles[v]?.bg || 'rgba(100,116,139,0.1)', color: typeStyles[v]?.color || '#64748b' }}>{typeStyles[v]?.label || v}</span> },
    { key: 'parent', label: t('parentCategory'), render: (_, row) => <span style={{ fontSize: 12 }}>{row._parentName || '—'}</span> },
    { key: 'actions', label: t('actions'), render: (_, row) => <span style={{ display: 'inline-flex', gap: 6 }}><button type="button" className="noorix-btn-nav" style={{ fontSize: 12 }} onClick={() => openEdit(row)}>{t('edit')}</button><button type="button" className="noorix-btn-nav" style={{ fontSize: 12, color: 'var(--noorix-text-danger)' }} onClick={() => handleDelete(row)}>{t('delete')}</button></span> },
  ], [t, typeStyles]);

  if (!companyId) return null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className={`noorix-btn-nav${showForm ? '' : ' noorix-btn-primary'}`} onClick={() => (showForm ? resetForm() : setShowForm(true))}>{showForm ? t('cancel') : t('addCategory')}</button>
      </div>
      {showForm && (
        <div className="noorix-surface-card" style={{ padding: 20, borderRadius: 14 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 14 }}>{editing ? t('editCategory') : t('newCategory')}</h4>
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('nameAr')} *</label><input type="text" value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', fontSize: 13 }} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('nameEnCol')}</label><input type="text" value={form.nameEn} onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', fontSize: 13 }} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('type')}</label><select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', fontSize: 13 }}><option value="purchase">{t('categoryTypes')}</option><option value="expense">{t('categoryTypeExpense')}</option><option value="sale">{t('categoryTypeSale')}</option></select></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('icon')}</label><input type="text" value={form.icon} onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))} placeholder="📁" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', fontSize: 13 }} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('parentCategory')}</label><select value={form.parentId} onChange={(e) => handleParentChange(e.target.value)} style={{ width: '100%', maxWidth: 320, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', fontSize: 13 }}><option value="">— تصنيف رئيسي —</option>{roots.filter((c) => c.id !== editing?.id).map((c) => <option key={c.id} value={c.id}>{c.icon || ''} {c.nameAr}</option>)}</select></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}><button type="submit" className="noorix-btn-primary" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? t('saving') : t('save')}</button><button type="button" className="noorix-btn-nav" onClick={resetForm}>{t('cancel')}</button></div>
          </form>
        </div>
      )}
      <div style={{ textAlign: 'right', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t(titleKey)}</h3>
      </div>
      <SmartTable columns={columns} data={rows} total={rows.length} page={1} pageSize={50} showRowNumbers rowNumberWidth="1%" isLoading={isLoading} emptyMessage={t('noCategories')} />
    </div>
  );
});
