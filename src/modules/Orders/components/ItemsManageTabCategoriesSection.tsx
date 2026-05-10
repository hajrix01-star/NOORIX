import React, { useState } from 'react';
import { OrdersImportHelpTrigger } from './OrdersImportHelpTrigger';
import { OrdersImportModal } from './OrdersImportModal';
import { Button, Input } from '../../../ui';

/** Categories sub-tab UI for `ItemsManageTab` (presentation + local layout only). */
export function ItemsManageTabCategoriesSection({ ctrl }: any) {
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

  const allFilteredIds = filteredCategories.map((c: any) => c.id);
  const allSelected = allFilteredIds.length > 0 && selectedCategoryIds.size === allFilteredIds.length;
  const someSelected = selectedCategoryIds.size > 0;

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
        <div className="flex flex-col gap-3 mb-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="m-0 text-[15px]">+ {t('ordersAddCategory')}</h4>
            <OrdersImportHelpTrigger t={t} variant="categories" />
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-2 w-max">
              <Button size="sm" onClick={handleDownloadCategoriesImportTemplate}>
                {t('ordersDownloadImportTemplate')}
              </Button>
              <Button size="sm" onClick={() => setShowImportModal(true)} disabled={createCategoriesBatch.isPending}>
                {t('import')}
              </Button>
              <Button size="sm" onClick={handleExportCategories} disabled={categories.length === 0}>
                {t('exportExcel')}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-3 flex flex-wrap items-end">
          <div className="min-w-[180px]">
            <Input
              label={`${t('categoryNameAr')} *`}
              value={newCategory.nameAr}
              onChange={(e: any) => setNewCategory((p: any) => ({ ...p, nameAr: e.target.value }))}
              placeholder={t('categoryNameAr')}
            />
          </div>
          <div className="min-w-[180px]">
            <Input
              label={t('categoryNameEn')}
              value={newCategory.nameEn}
              onChange={(e: any) => setNewCategory((p: any) => ({ ...p, nameEn: e.target.value }))}
              placeholder={t('categoryNameEn')}
            />
          </div>
          <Button size="sm" variant="primary" onClick={handleCreateCategory} disabled={createCategory.isPending || !companyId}>
            {createCategory.isPending ? t('saving') : t('add')}
          </Button>
        </div>
      </div>

      <div className="noorix-surface-card overflow-auto">
        <div className="nx-section-header justify-between gap-2">
          {someSelected ? (
            <Button
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
            onChange={(e: any) => setCategorySearchQuery(e.target.value)}
            placeholder={t('ordersSearchCategories')}
            aria-label={t('ordersSearchCategories')}
            className="max-w-[320px]"
          />
        </div>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b-2 border-noorix-border">
              <th className="py-[10px] px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => toggleAllCategories(allFilteredIds)}
                  aria-label={t('ordersSelectAll')}
                  className="cursor-pointer"
                />
              </th>
              <th className="font-bold text-right py-[10px] px-3">{t('categoryNameAr')}</th>
              <th className="font-bold text-right py-[10px] px-3">{t('categoryNameEn')}</th>
              <th className="text-center font-bold py-[10px] px-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredCategories.map((c: any) => (
              <tr
                key={c.id}
                className={`border-b border-noorix-border${selectedCategoryIds.has(c.id) ? ' bg-noorix-bg-muted' : ''}`}
              >
                {editingCategory?.id === c.id ? (
                  <>
                    <td className="py-2 px-3 text-center">
                      <input type="checkbox" checked={selectedCategoryIds.has(c.id)} onChange={() => toggleCategorySelection(c.id)} className="cursor-pointer" />
                    </td>
                    <td className="py-2 px-3">
                      <Input type="text" value={editingCategory.nameAr} onChange={(e: any) => setEditingCategory((x: any) => ({ ...x, nameAr: e.target.value }))} placeholder={t('categoryNameAr')} />
                    </td>
                    <td className="py-2 px-3">
                      <Input type="text" value={editingCategory.nameEn || ''} onChange={(e: any) => setEditingCategory((x: any) => ({ ...x, nameEn: e.target.value }))} placeholder={t('categoryNameEn')} />
                    </td>
                    <td className="text-center py-2 px-3">
                      <div className="nx-toolbar justify-center">
                        <Button size="sm" onClick={handleUpdateCategory}>
                          {t('save')}
                        </Button>
                        <Button size="sm" onClick={() => setEditingCategory(null)}>
                          {t('cancel')}
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-[10px] px-3 text-center">
                      <input type="checkbox" checked={selectedCategoryIds.has(c.id)} onChange={() => toggleCategorySelection(c.id)} className="cursor-pointer" />
                    </td>
                    <td className="py-[10px] px-3">{c.nameAr || '—'}</td>
                    <td className="nx-cell-muted py-[10px] px-3">{c.nameEn || '—'}</td>
                    <td className="text-center py-[10px] px-3">
                      <Button size="sm" onClick={() => setEditingCategory({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn || '' })}>{t('edit')}</Button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && <div className="text-center text-noorix-muted p-[30px]">{t('ordersNoCategoriesYet')}</div>}
        {categories.length > 0 && filteredCategories.length === 0 && <div className="text-center text-noorix-muted p-[30px]">{t('ordersNoSearchResults')}</div>}
      </div>
    </div>
    </>
  );
}
