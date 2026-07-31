import React, { type ChangeEvent, useMemo, useState } from 'react';
import { OrdersImportHelpTrigger } from './OrdersImportHelpTrigger';
import { OrdersImportModal } from './OrdersImportModal';
import { AdaptiveSheet, Button, Checkbox, DialogActions, Input, SimpleTable } from '../../../ui';
import type { SimpleTableColumn } from '../../../ui';
import type { OrderCategory, OrderProduct } from '../../../types/api';
import type { ItemsManageTabController } from '../hooks/useItemsManageTab';
import { CategoryTranslationModal } from './catalog/CategoryTranslationModal';

type CategoryFormMode = 'create' | 'edit' | null;
type CategoryTableRow = OrderCategory & { resolvedProductCount: number };

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
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [formMode, setFormMode] = useState<CategoryFormMode>(null);
  const [viewingCategory, setViewingCategory] = useState<OrderCategory | null>(null);

  const allFilteredIds = filteredCategories.map((category) => category.id);
  const allSelected = allFilteredIds.length > 0 && selectedCategoryIds.size === allFilteredIds.length;
  const someSelected = selectedCategoryIds.size > 0;
  const form = formMode === 'edit' ? editingCategory : newCategory;
  const saving = formMode === 'edit' ? updateCategory.isPending : createCategory.isPending;
  const productsByCategory = useMemo(() => {
    const grouped = new Map<string, OrderProduct[]>();
    for (const product of products) {
      if (!product.isActive || !product.categoryId) continue;
      const rows = grouped.get(product.categoryId) ?? [];
      rows.push(product);
      grouped.set(product.categoryId, rows);
    }
    return grouped;
  }, [products]);
  const categoryRows = useMemo<CategoryTableRow[]>(
    () => filteredCategories.map((category) => ({
      ...category,
      resolvedProductCount: category.productCount ?? productsByCategory.get(category.id)?.length ?? 0,
    })),
    [filteredCategories, productsByCategory],
  );
  const viewingProducts = useMemo(
    () => (viewingCategory ? productsByCategory.get(viewingCategory.id) ?? [] : []),
    [productsByCategory, viewingCategory],
  );

  const categoryColumns = useMemo<SimpleTableColumn<CategoryTableRow>[]>(() => [
    {
      key: 'selected',
      label: (
        <Checkbox
          checked={allSelected}
          onChange={() => toggleAllCategories(allFilteredIds)}
          aria-label={t('ordersSelectAll')}
        />
      ),
      width: 54,
      align: 'center',
      render: (_value, row) => (
        <span onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={selectedCategoryIds.has(row.id)}
            onChange={() => toggleCategorySelection(row.id)}
            aria-label={`${t('ordersCategories')}: ${row.nameAr}`}
          />
        </span>
      ),
    },
    {
      key: 'nameAr',
      label: t('categoryNameAr'),
      minWidth: 180,
      render: (_value, row) => <strong>{row.nameAr}</strong>,
    },
    {
      key: 'nameEn',
      label: t('categoryNameEn'),
      minWidth: 180,
      render: (_value, row) => <span className="text-noorix-muted">{row.nameEn || '-'}</span>,
    },
    {
      key: 'resolvedProductCount',
      label: t('ordersCategoryItemCount'),
      width: 130,
      numeric: true,
      render: (_value, row) => <strong>{row.resolvedProductCount}</strong>,
    },
    {
      key: 'actions',
      label: t('actions'),
      width: 110,
      align: 'center',
      render: (_value, row) => (
        <span onClick={(event) => event.stopPropagation()}>
          <Button type="button" size="sm" onClick={() => openEditForm(row)}>{t('edit')}</Button>
        </span>
      ),
    },
  ], [
    allFilteredIds,
    allSelected,
    selectedCategoryIds,
    t,
    toggleAllCategories,
    toggleCategorySelection,
  ]);

  const categoryProductColumns = useMemo<SimpleTableColumn<OrderProduct>[]>(() => [
    {
      key: 'nameAr',
      label: t('productNameAr'),
      minWidth: 190,
      render: (_value, row) => <strong>{row.nameAr}</strong>,
    },
    {
      key: 'nameEn',
      label: t('productNameEn'),
      minWidth: 180,
      render: (_value, row) => <span className="text-noorix-muted">{row.nameEn || '-'}</span>,
    },
    {
      key: 'productType',
      label: t('type'),
      width: 150,
      render: (_value, row) => (row.productType === 'sale' ? t('salesProducts') : t('ordersProducts')),
    },
    {
      key: 'unit',
      label: t('unit'),
      width: 120,
      render: (_value, row) => row.unit || '-',
    },
  ], [t]);

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

      <CategoryTranslationModal
        open={showTranslationModal}
        companyId={companyId}
        onClose={() => setShowTranslationModal(false)}
      />

      <AdaptiveSheet
        open={viewingCategory !== null}
        onClose={() => setViewingCategory(null)}
        title={viewingCategory ? `${t('ordersCategoryDetails')}: ${viewingCategory.nameAr}` : t('ordersCategoryDetails')}
        size="lg"
        side="start"
      >
        <SimpleTable
          columns={categoryProductColumns}
          data={viewingProducts}
          tableMinWidth={640}
          emptyMessage={t('ordersNoCategoryItems')}
        />
      </AdaptiveSheet>

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
            <Button type="button" size="sm" onClick={() => setShowTranslationModal(true)}>
              {t('ordersTranslateCategories')}
            </Button>
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
          <SimpleTable
            columns={categoryColumns}
            data={categoryRows}
            tableMinWidth={720}
            emptyMessage={categories.length === 0 ? t('ordersNoCategoriesYet') : t('ordersNoSearchResults')}
            getRowClassName={(row) => selectedCategoryIds.has(row.id) ? 'bg-noorix-bg-muted cursor-pointer' : 'cursor-pointer'}
            onRowClick={(row) => setViewingCategory(row)}
          />
        </div>
      </div>
    </>
  );
}
