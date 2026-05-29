import React, { useEffect, useState } from 'react';
import { OrdersImportModal } from '../OrdersImportModal';
import { ItemsCatalogPrintModal } from '../ItemsCatalogPrintModal';
import { ItemsCatalogWeeklyPrintModal } from '../ItemsCatalogWeeklyPrintModal';
import { Modal, Button } from '../../../../ui';
import { CatalogSetupGuide } from './CatalogSetupGuide';
import { CatalogInfoBanner } from './CatalogInfoBanner';
import { CatalogTypeSegment } from './CatalogTypeSegment';
import { CatalogToolbar } from './CatalogToolbar';
import { CatalogProductTable } from './CatalogProductTable';
import { CatalogProductFormSheet } from './CatalogProductFormSheet';

export function CatalogProductsPanel({ ctrl }: { ctrl: any }) {
  const {
    t,
    companyId,
    catalogProductType,
    setCatalogProductType,
    setActiveSubTab,
    catalogFilteredProducts,
    products,
    categories,
    sections,
    productSearchQuery,
    setProductSearchQuery,
    productFilterSection,
    setProductFilterSection,
    productFilterCategory,
    setProductFilterCategory,
    selectedProductIds,
    toggleProductSelection,
    toggleAllProducts,
    handleDeleteSelectedProducts,
    deleteProductsMutation,
    createProductsBatch,
    createCategoriesBatch,
    presetBusy,
    handleInsertPresetCatalog,
    handleDownloadProductsImportTemplate,
    handleExportProducts,
    newProduct,
    setNewProduct,
    editingProduct,
    setEditingProduct,
    resetNewProductForm,
    openEditProduct,
    handleCreateProduct,
    handleUpdateProduct,
    sizesOptions,
    packagingOptions,
    setAddSizeModal,
    setAddPackagingModal,
    addVariantToProduct,
    updateNewProductVariant,
    removeNewProductVariant,
    updateEditingVariant,
    removeEditingVariant,
    createProduct,
    updateProduct,
    bulkSetSections,
  } = ctrl;

  const [showImportModal, setShowImportModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showWeeklyPrintModal, setShowWeeklyPrintModal] = useState(false);
  const [bulkSectionModal, setBulkSectionModal] = useState(false);
  const [bulkSelectedSections, setBulkSelectedSections] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<'replace' | 'add'>('replace');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'create' | 'edit'>('create');

  const totalOfType = (products as any[]).filter((p: any) => (p.productType || 'order') === catalogProductType).length;

  useEffect(() => {
    setNewProduct((p: any) => ({ ...p, productType: catalogProductType }));
  }, [catalogProductType, setNewProduct]);

  function openCreateSheet() {
    resetNewProductForm(catalogProductType);
    setEditingProduct(null);
    setSheetMode('create');
    setSheetOpen(true);
  }

  function openEditSheet(row: any) {
    openEditProduct(row);
    setSheetMode('edit');
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditingProduct(null);
  }

  const activeForm = sheetMode === 'edit' ? editingProduct : newProduct;
  const setActiveForm = sheetMode === 'edit' ? setEditingProduct : setNewProduct;

  function handleSave() {
    if (sheetMode === 'edit') {
      handleUpdateProduct(() => closeSheet());
    } else {
      handleCreateProduct(() => closeSheet());
    }
  }

  async function handleBulkApply() {
    setBulkBusy(true);
    try {
      await bulkSetSections.mutateAsync({
        productIds: [...selectedProductIds],
        sectionIds: bulkSelectedSections,
        mode: bulkMode,
      });
      setBulkSectionModal(false);
      setBulkSelectedSections([]);
    } finally {
      setBulkBusy(false);
    }
  }

  function handleDeactivateOne(row: any) {
    if (!window.confirm(t('ordersProductDeactivateConfirm'))) return;
    deleteProductsMutation.mutate([row.id]);
  }

  const variantHandlers = sheetMode === 'edit'
    ? {
        addVariant: () => setEditingProduct((p: any) => ({
          ...p,
          variants: [...(p.variants || []), { size: '', packaging: '', unit: 'piece', lastPrice: '' }],
        })),
        updateVariant: updateEditingVariant,
        removeVariant: removeEditingVariant,
      }
    : {
        addVariant: addVariantToProduct,
        updateVariant: updateNewProductVariant,
        removeVariant: removeNewProductVariant,
      };

  return (
    <>
      <ItemsCatalogPrintModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        companyId={companyId}
        products={products}
        categories={categories}
        sections={sections}
        productTypeFilter={catalogProductType}
        initialSection={productFilterSection}
        initialCategoryId={productFilterCategory}
      />
      <ItemsCatalogWeeklyPrintModal
        open={showWeeklyPrintModal}
        onClose={() => setShowWeeklyPrintModal(false)}
        companyId={companyId}
        products={products}
        categories={categories}
        sections={sections}
        productTypeFilter={catalogProductType}
        initialSection={productFilterSection}
        initialCategoryId={productFilterCategory}
      />
      {showImportModal && (
        <OrdersImportModal
          type="products"
          productType={catalogProductType}
          sections={sections}
          companyId={companyId}
          products={products}
          categories={categories}
          createProductsBatch={createProductsBatch}
          createCategoriesBatch={createCategoriesBatch}
          onClose={() => setShowImportModal(false)}
        />
      )}

      <Modal
        open={bulkSectionModal}
        onClose={() => setBulkSectionModal(false)}
        title={`${t('bulkAssignSections')} (${selectedProductIds.size})`}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {(sections as any[]).length === 0 ? (
            <p className="text-noorix-muted text-[13px]">{t('sectionsEmpty')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-[12px] text-noorix-muted mb-1">{t('bulkSelectSections')}</div>
              {(sections as any[]).map((s: any) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer text-[13px]">
                  <input
                    type="checkbox"
                    checked={bulkSelectedSections.includes(s.id)}
                    onChange={(e) => {
                      if (e.target.checked) setBulkSelectedSections((prev) => [...prev, s.id]);
                      else setBulkSelectedSections((prev) => prev.filter((n) => n !== s.id));
                    }}
                    className="cursor-pointer"
                  />
                  {s.nameAr}{s.nameEn ? ` / ${s.nameEn}` : ''}
                </label>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input type="radio" checked={bulkMode === 'replace'} onChange={() => setBulkMode('replace')} />
              {t('bulkModeReplace')}
            </label>
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input type="radio" checked={bulkMode === 'add'} onChange={() => setBulkMode('add')} />
              {t('bulkModeAdd')}
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleBulkApply} disabled={bulkBusy}>
              {bulkBusy ? t('saving') : t('apply')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBulkSectionModal(false)}>{t('cancel')}</Button>
          </div>
        </div>
      </Modal>

      <CatalogProductFormSheet
        open={sheetOpen}
        mode={sheetMode}
        productType={catalogProductType}
        form={activeForm}
        setForm={setActiveForm}
        categories={categories}
        sections={sections}
        sizesOptions={sizesOptions}
        packagingOptions={packagingOptions}
        saving={sheetMode === 'edit' ? updateProduct.isPending : createProduct.isPending}
        onClose={closeSheet}
        onSave={handleSave}
        onAddSize={() => setAddSizeModal(true)}
        onAddPackaging={() => setAddPackagingModal(true)}
        addVariant={variantHandlers.addVariant}
        updateVariant={variantHandlers.updateVariant}
        removeVariant={variantHandlers.removeVariant}
      />

      <div className="flex flex-col gap-4">
        <CatalogTypeSegment value={catalogProductType} onChange={setCatalogProductType} />
        <CatalogInfoBanner productType={catalogProductType} />
        <CatalogSetupGuide
          t={t}
          sectionsCount={(sections as any[]).length}
          categoriesCount={(categories as any[]).length}
          productsCount={totalOfType}
          onGoSections={() => setActiveSubTab('sections')}
          onGoCategories={() => setActiveSubTab('categories')}
          onImport={() => setShowImportModal(true)}
          onAddProduct={openCreateSheet}
        />

        <div className="noorix-surface-card p-4 flex flex-col gap-4">
          <CatalogToolbar
            productType={catalogProductType}
            productSearchQuery={productSearchQuery}
            setProductSearchQuery={setProductSearchQuery}
            productFilterSection={productFilterSection}
            setProductFilterSection={setProductFilterSection}
            productFilterCategory={productFilterCategory}
            setProductFilterCategory={setProductFilterCategory}
            sections={sections}
            categories={categories}
            filteredCount={catalogFilteredProducts.length}
            totalCount={totalOfType}
            selectedCount={selectedProductIds.size}
            onAddProduct={openCreateSheet}
            onBulkSections={() => { setBulkSelectedSections([]); setBulkSectionModal(true); }}
            onDeactivateSelected={handleDeleteSelectedProducts}
            deactivatePending={deleteProductsMutation.isPending}
            onDownloadTemplate={() => handleDownloadProductsImportTemplate(catalogProductType)}
            onImport={() => setShowImportModal(true)}
            onExport={() => handleExportProducts(catalogProductType)}
            onPrintCatalog={() => setShowPrintModal(true)}
            onPrintWeekly={() => setShowWeeklyPrintModal(true)}
            onPreset={catalogProductType === 'order' ? handleInsertPresetCatalog : undefined}
            presetBusy={presetBusy}
            importPending={createProductsBatch.isPending}
            exportDisabled={catalogFilteredProducts.length === 0}
            printDisabled={catalogFilteredProducts.length === 0}
          />

          <CatalogProductTable
            rows={catalogFilteredProducts}
            selectedIds={selectedProductIds}
            onToggleSelect={toggleProductSelection}
            onToggleAll={toggleAllProducts}
            onEdit={openEditSheet}
            onDeactivate={handleDeactivateOne}
          />
        </div>
      </div>
    </>
  );
}
