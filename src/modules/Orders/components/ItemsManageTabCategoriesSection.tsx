import React, { type ChangeEvent, useState } from 'react';
import { OrdersImportHelpTrigger } from './OrdersImportHelpTrigger';
import { OrdersImportModal } from './OrdersImportModal';
import { Button, Checkbox, Input } from '../../../ui';
import type { OrderCategory } from '../../../types/api';
import type { ItemsManageTabController } from '../hooks/useItemsManageTab';

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

  const allFilteredIds = filteredCategories.map((category) => category.id);
  const allSelected = allFilteredIds.length > 0 && selectedCategoryIds.size === allFilteredIds.length;
  const someSelected = selectedCategoryIds.size > 0;

  function updateNewCategory(patch: Partial<{ nameAr: string; nameEn: string }>) {
    setNewCategory((current) => ({ ...current, ...patch }));
  }

  function updateEditingCategory(patch: Partial<Pick<OrderCategory, 'nameAr' | 'nameEn'>>) {
    setEditingCategory((current) => (current ? { ...current, ...patch } : current));
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
      <div className="grid gap-5">
        <div className="noorix-surface-card p-4 lg:p-5">
          <div className="mb-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="m-0 text-[15px]">+ {t('ordersAddCategory')}</h4>
              <OrdersImportHelpTrigger t={t} variant="categories" />
            </div>
            <div className="overflow-x-auto">
              <div className="flex w-max gap-2">
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
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px]">
              <Input
                label={`${t('categoryNameAr')} *`}
                value={newCategory.nameAr}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateNewCategory({ nameAr: event.target.value })}
                placeholder={t('categoryNameAr')}
              />
            </div>
            <div className="min-w-[180px]">
              <Input
                label={t('categoryNameEn')}
                value={newCategory.nameEn}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateNewCategory({ nameEn: event.target.value })}
                placeholder={t('categoryNameEn')}
              />
            </div>
            <Button type="button" size="sm" variant="primary" onClick={handleCreateCategory} disabled={createCategory.isPending || !companyId}>
              {createCategory.isPending ? t('saving') : t('add')}
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
                  {editingCategory?.id === category.id ? (
                    <>
                      <td className="px-3 py-2 text-center">
                        <Checkbox checked={selectedCategoryIds.has(category.id)} onChange={() => toggleCategorySelection(category.id)} className="cursor-pointer" />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="text"
                          value={editingCategory.nameAr}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => updateEditingCategory({ nameAr: event.target.value })}
                          placeholder={t('categoryNameAr')}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="text"
                          value={editingCategory.nameEn || ''}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => updateEditingCategory({ nameEn: event.target.value })}
                          placeholder={t('categoryNameEn')}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="nx-toolbar justify-center">
                          <Button type="button" size="sm" onClick={handleUpdateCategory}>{t('save')}</Button>
                          <Button type="button" size="sm" onClick={() => setEditingCategory(null)}>{t('cancel')}</Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-[10px] text-center">
                        <Checkbox checked={selectedCategoryIds.has(category.id)} onChange={() => toggleCategorySelection(category.id)} className="cursor-pointer" />
                      </td>
                      <td className="px-3 py-[10px]">{category.nameAr || '-'}</td>
                      <td className="nx-cell-muted px-3 py-[10px]">{category.nameEn || '-'}</td>
                      <td className="px-3 py-[10px] text-center">
                        <Button type="button" size="sm" onClick={() => setEditingCategory(category)}>{t('edit')}</Button>
                      </td>
                    </>
                  )}
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
