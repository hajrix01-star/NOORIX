import React, { type ChangeEvent, useState } from 'react';
import { OrdersImportHelpTrigger } from './OrdersImportHelpTrigger';
import { OrdersImportModal } from './OrdersImportModal';
import { AdaptiveSheet, Button, Checkbox, DialogActions, Input } from '../../../ui';
import type { OrderCategory } from '../../../types/api';
import type { ItemsManageTabController } from '../hooks/useItemsManageTab';

type CategoryFormMode = 'create' | 'edit' | null;

export function ItemsManageTabCategoriesSection({ ctrl }: { ctrl: ItemsManageTabController }) {
  const {
    t,
    companyId,
    products,
    categories,
    filteredCategories,
    newCategory,
    setNewCategory,
    editingCategory,
    setEditingCategory,
    categorySearchQuery,
    setCategorySearchQuery,
    createCategory,
    updateCategory,
    createProductsBatch,
    createCategoriesBatch,
    handleDownloadCategoriesImportTemplate,
    handleExportCategories,
    handleCreateCategory,
    handleUpdateCategory,
    selectedCategoryIds,
    toggleCategorySelection,
    toggleAllCategories,
    handleDeleteSelectedCategories,
    deleteCategoriesMutation,
  } = ctrl;

  const [showImportModal, setShowImportModal] = useState(false);
  const [formMode, setFormMode] = useState<CategoryFormMode>(null);

  const allFilteredIds = filteredCategories.map((category) => category.id);
  const allSelected = allFilteredIds.length > 0 && selectedCategoryIds.size === allFilteredIds.length;
  const someSelected = selectedCategoryIds.size > 0;
  const form = formMode === 'edit' ? editingCategory : newCategory;
  const saving = formMode === 'edit' ? updateCategory.isPending : createCategory.isPending;

  function openCreateForm() {
    setEditingCategory(null);
    setNewCategory({ nameAr: '', nameEn: '' });
    setFormMode('create');
  }

  function openEditForm(category: OrderCategory) {
    setEditingCategory({ ...category, nameEn: category.nameEn || '' });
    setFormMode('edit');
  }

  function closeForm() {
    if (saving) return;
    setFormMode(null);
    setEditingCategory(null);
  }

  function updateForm(patch: Partial<{ nameAr: string; nameEn: string }>) {
    if (formMode === 'edit') {
      setEditingCategory((current) => (current ? { ...current, ...patch } : current));
      return;
    }
    setNewCategory((current) => ({ ...current, ...patch }));
  }

  function saveForm() {
    if (formMode === 'edit') {
      handleUpdateCategory(closeForm);
    } else {
      handleCreateCategory(closeForm);
    }
  }

  return (
    <>
      {showImportModal && (
        <OrdersImportModal
          type="categories"
          companyId={companyId}
          products={products}
          categories={categories}
          createProductsBatch={createProductsBatch}
          createCategoriesBatch={createCategoriesBatch}
          onClose={() => setShowImportModal(false)}
        />
      )}

      <AdaptiveSheet
        open={formMode !== null}
        onClose={closeForm}
        title={formMode === 'edit' ? t('ordersEditCategory') : t('ordersAddCategory')}
        size="sm"
        side="start"
        footer={(
          <DialogActions
            actions={[
              { key: 'cancel', label: t('cancel'), role: 'cancel', disabled: saving, onClick: closeForm },
              { key: 'save', label: t('save'), role: 'save', loading: saving, disabled: saving, onClick: saveForm },
            ]}
          />
        )}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={`${t('categoryNameAr')} *`}
            value={form?.nameAr || ''}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm({ nameAr: event.target.value })}
            placeholder={t('categoryNameAr')}
            autoFocus
          />
          <Input
            label={t('categoryNameEn')}
            value={form?.nameEn || ''}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm({ nameEn: event.target.value })}
            placeholder={t('categoryNameEn')}
          />
        </div>
      </AdaptiveSheet>

      <div className="grid gap-4">
        <div className="noorix-surface-card flex flex-wrap items-center justify-between gap-2 p-3">
          <Button type="button" size="sm" variant="primary" onClick={openCreateForm}>
            + {t('ordersAddCategory')}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <OrdersImportHelpTrigger t={t} variant="categories" />
            <Button type="button" size="sm" onClick={handleDownloadCategoriesImportTemplate}>
              {t('ordersDownloadImportTemplate')}
            </Button>
            <Button type="button" size="sm" onClick={() => setShowImportModal(true)} disabled={createCategoriesBatch.isPending}>
              {t('import')}
            </Button>
            <Button type="button" size="sm" onClick={handleExportCategories} disabled={categories.length === 0}>
              {t('exportExcel')}
            </Button>
          </div>
        </div>

        <div className="noorix-surface-card overflow-auto">
          <div className="nx-section-header justify-between gap-2">
            {someSelected ? (
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={handleDeleteSelectedCategories}
                disabled={deleteCategoriesMutation.isPending}
              >
                {deleteCategoriesMutation.isPending
                  ? t('saving')
                  : `${t('ordersDeleteSelected')} (${selectedCategoryIds.size})`}
              </Button>
            ) : (
              <span />
            )}
            <Input
              type="search"
              value={categorySearchQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setCategorySearchQuery(event.target.value)}
              placeholder={t('ordersSearchCategories')}
              aria-label={t('ordersSearchCategories')}
              className="max-w-[320px]"
            />
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b-2 border-noorix-border">
                <th className="w-10 px-3 py-[10px] text-center">
                  <Checkbox
                    checked={allSelected}
                    onChange={() => toggleAllCategories(allFilteredIds)}
                    aria-label={t('ordersSelectAll')}
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-3 py-[10px] text-right font-bold">{t('categoryNameAr')}</th>
                <th className="px-3 py-[10px] text-right font-bold">{t('categoryNameEn')}</th>
                <th className="px-3 py-[10px] text-center font-bold">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((category) => (
                <tr
                  key={category.id}
                  className={`border-b border-noorix-border${selectedCategoryIds.has(category.id) ? ' bg-noorix-bg-muted' : ''}`}
                >
                  <td className="px-3 py-[10px] text-center">
                    <Checkbox
                      checked={selectedCategoryIds.has(category.id)}
                      onChange={() => toggleCategorySelection(category.id)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-[10px]">{category.nameAr || '-'}</td>
                  <td className="nx-cell-muted px-3 py-[10px]">{category.nameEn || '-'}</td>
                  <td className="px-3 py-[10px] text-center">
                    <Button type="button" size="sm" onClick={() => openEditForm(category)}>{t('edit')}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {categories.length === 0 && <div className="p-[30px] text-center text-noorix-muted">{t('ordersNoCategoriesYet')}</div>}
          {categories.length > 0 && filteredCategories.length === 0 && <div className="p-[30px] text-center text-noorix-muted">{t('ordersNoSearchResults')}</div>}
        </div>
      </div>
    </>
  );
}
