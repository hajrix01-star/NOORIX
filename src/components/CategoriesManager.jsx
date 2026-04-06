/**
 * CategoriesManager — مكون مشترك لإدارة التصنيفات (فئات الحسابات)
 * يُستخدم في: Suppliers/CategoriesTab (الموردين والتصنيفات)
 */
import React, { useState, useMemo, memo } from 'react';
import { useCategories } from '../hooks/useCategories';
import { useTranslation } from '../i18n/useTranslation';
import Toast from './Toast';
import SmartTable from './common/SmartTable';
import { Button, Input, Card, Badge, FormRow } from '../ui';

const TYPE_MAP = {
  purchase: { labelKey: 'categoryTypes' },
  expense: { labelKey: 'categoryTypeExpense' },
  sale: { labelKey: 'categoryTypeSale' },
};

const TYPE_BADGE_COLOR = {
  purchase: 'blue',
  expense: 'amber',
  sale: 'green',
};

export const CategoriesManager = memo(function CategoriesManager({ companyId, titleKey = 'categoriesTab' }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [form, setForm] = useState({ nameAr: '', nameEn: '', type: 'purchase', icon: '', parentId: '' });

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

  const typeLabels = useMemo(() => ({
    purchase: t(TYPE_MAP.purchase.labelKey),
    expense: t(TYPE_MAP.expense.labelKey),
    sale: t(TYPE_MAP.sale.labelKey),
  }), [t]);

  function resetForm() {
    setForm({ nameAr: '', nameEn: '', type: 'purchase', icon: '', parentId: '' });
    setEditing(null);
    setShowForm(false);
  }

  function openEdit(cat) {
    setEditing(cat);
    setForm({ nameAr: cat.nameAr || '', nameEn: cat.nameEn || '', type: cat.type || 'purchase', icon: cat.icon || '', parentId: cat.parentId || '' });
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
    { key: 'nameEn', label: t('nameEnCol'), render: (v) => <span className="nx-cell-muted">{v || '—'}</span> },
    { key: 'type', label: t('type'), render: (v) => (
      <Badge color={TYPE_BADGE_COLOR[v] ?? 'gray'} size="sm">
        {typeLabels[v] || v}
      </Badge>
    ) },
    { key: 'parent', label: t('parentCategory'), render: (_, row) => <span className="nx-text-sm">{row._parentName || '—'}</span> },
    { key: 'actions', label: t('actions'), render: (_, row) => (
      <span style={{ display: 'inline-flex', gap: 6 }}>
        <Button size="sm" onClick={() => openEdit(row)}>{t('edit')}</Button>
        <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>{t('delete')}</Button>
      </span>
    ) },
  ], [t, typeLabels]);

  if (!companyId) return null;

  return (
    <div className="nx-screen">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />
      <div className="nx-flex nx-flex-end">
        <Button variant={showForm ? 'default' : 'primary'} onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? t('cancel') : t('addCategory')}
        </Button>
      </div>
      {showForm && (
        <Card>
          <h4 className="nx-text-md nx-m-0 nx-mb-16">{editing ? t('editCategory') : t('newCategory')}</h4>
          <form onSubmit={handleSave}>
            <FormRow cols={2} style={{ marginBottom: 14 }}>
              <Input
                type="text"
                label={`${t('nameAr')} *`}
                value={form.nameAr}
                onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
              />
              <Input
                type="text"
                label={t('nameEnCol')}
                value={form.nameEn}
                onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
              />
              <Input
                type="select"
                label={t('type')}
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option value="purchase">{t('categoryTypes')}</option>
                <option value="expense">{t('categoryTypeExpense')}</option>
                <option value="sale">{t('categoryTypeSale')}</option>
              </Input>
              <Input
                type="text"
                label={t('icon')}
                value={form.icon}
                onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                placeholder=""
              />
            </FormRow>
            <div style={{ marginBottom: 14 }}>
              <Input
                type="select"
                label={t('parentCategory')}
                value={form.parentId}
                onChange={(e) => handleParentChange(e.target.value)}
              >
                <option value="">— تصنيف رئيسي —</option>
                {roots.filter((c) => c.id !== editing?.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.icon || ''} {c.nameAr}</option>
                ))}
              </Input>
            </div>
            <div className="nx-flex nx-gap-8">
              <Button type="submit" variant="primary" disabled={create.isPending || update.isPending} loading={create.isPending || update.isPending}>
                {create.isPending || update.isPending ? t('saving') : t('save')}
              </Button>
              <Button type="button" onClick={resetForm}>{t('cancel')}</Button>
            </div>
          </form>
        </Card>
      )}
      <div className="nx-text-end nx-mb-8">
        <h3 className="nx-text-xl nx-font-700 nx-m-0">{t(titleKey)}</h3>
      </div>
      <SmartTable columns={columns} data={rows} total={rows.length} page={1} pageSize={50} showRowNumbers rowNumberWidth="1%" isLoading={isLoading} emptyMessage={t('noCategories')} />
    </div>
  );
});
