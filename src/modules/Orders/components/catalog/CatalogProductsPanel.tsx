import React, { useEffect, useState } from 'react';
import { OrdersImportModal } from '../OrdersImportModal';
import { ItemsCatalogPrintModal } from '../ItemsCatalogPrintModal';
import { ItemsCatalogWeeklyPrintModal } from '../ItemsCatalogWeeklyPrintModal';
import { Modal, Button, Checkbox, Radio } from '../../../../ui';
import { CatalogSetupGuide } from './CatalogSetupGuide';
import { CatalogInfoBanner } from './CatalogInfoBanner';
import { CatalogTypeSegment } from './CatalogTypeSegment';
import { CatalogToolbar } from './CatalogToolbar';
import { CatalogProductTable } from './CatalogProductTable';
import { CatalogProductFormSheet, type CatalogProductFormState } from './CatalogProductFormSheet';
import { OrderConfirmModal } from '../OrderConfirmModal';
import type { ItemsManageTabController } from '../../hooks/useItemsManageTab';
import type { OrderProduct } from '../../../../types/api';
import { filterRecipeMaterialProducts } from '../../utils/itemsManageModel';

type DeactivateTarget = 'selected' | { id: string };

export function CatalogProductsPanel({ ctrl }: { ctrl: ItemsManageTabController }) {
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
    catalogUnits,
    conversionTemplates,
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
  const [deactivateTarget, setDeactivateTarget] = useState<DeactivateTarget | null>(null);

  const totalOfType = products.filter((p) => (p.productType || 'order') === catalogProductType).length;

  useEffect(() => {
    setNewProduct((p) => ({ ...p, productType: catalogProductType }));
  }, [catalogProductType, setNewProduct]);

  function openCreateSheet() {
    resetNewProductForm(catalogProductType);
    setEditingProduct(null);
    setSheetMode('create');
    setSheetOpen(true);
  }

  function openEditSheet(row: OrderProduct) {
    openEditProduct(row);
    setSheetMode('edit');
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditingProduct(null);
  }

  const activeForm: CatalogProductFormState | null = sheetMode === 'edit'
    ? editingProduct
      ? {
          ...editingProduct,
          nameAr: editingProduct.nameAr || '',
          nameEn: editingProduct.nameEn || '',
          categoryId: editingProduct.categoryId || '',
          sectionIds: editingProduct.sectionIds || [],
          productType: editingProduct.productType || catalogProductType,
          unit: editingProduct.unit || 'piece',
          simpleLastPrice: editingProduct.simpleLastPrice || '',
          variants: editingProduct.variants || [],
          inventoryConversions: editingProduct.inventoryConversions || [],
          conversionTemplateId: editingProduct.conversionTemplateId || '',
          recipe: editingProduct.recipe || [],
        }
      : null
    : newProduct;

  function setActiveForm(
    action: React.SetStateAction<CatalogProductFormState | null>,
  ) {
    const normalizeVariants = (variants: CatalogProductFormState['variants']) =>
      variants.map((variant) => ({
        size: variant.size || '',
        packaging: variant.packaging || '',
        unit: variant.unit || 'piece',
        lastPrice: String(variant.lastPrice ?? ''),
        quantityMultiplier: String(variant.quantityMultiplier ?? '1'),
      }));
    const resolve = (current: CatalogProductFormState | null) =>
      typeof action === 'function' ? action(current) : action;

    if (sheetMode === 'edit') {
      setEditingProduct((current) => resolve(current ? {
        ...current,
        nameAr: current.nameAr || '',
        nameEn: current.nameEn || '',
        categoryId: current.categoryId || '',
        sectionIds: current.sectionIds || [],
        productType: current.productType || catalogProductType,
        unit: current.unit || 'piece',
        simpleLastPrice: current.simpleLastPrice || '',
        variants: normalizeVariants(current.variants || []),
        inventoryConversions: current.inventoryConversions || [],
        conversionTemplateId: current.conversionTemplateId || '',
        recipe: current.recipe || [],
      } : null));
      return;
    }

    setNewProduct((current) => {
      const next = resolve(current);
      if (!next) return current;
      return {
        nameAr: next.nameAr,
        nameEn: next.nameEn,
        categoryId: next.categoryId,
        sectionIds: next.sectionIds,
        productType: next.productType,
        unit: next.unit || 'piece',
        simpleLastPrice: next.simpleLastPrice,
        variants: normalizeVariants(next.variants),
        inventoryConversions: next.inventoryConversions || [],
        conversionTemplateId: next.conversionTemplateId || '',
        recipe: next.recipe || [],
      };
    });
  }

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

  const variantHandlers = sheetMode === 'edit'
    ? {
        addVariant: () => setEditingProduct((p) => p ? ({
          ...p,
          variants: [...(p.variants || []), { size: '', packaging: '', unit: 'piece', lastPrice: '', quantityMultiplier: '1' }],
        }) : p),
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
        initialSearch={productSearchQuery}
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
        initialSearch={productSearchQuery}
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
      <OrderConfirmModal
        open={!!deactivateTarget}
        title={t('confirmDelete')}
        message={t('ordersProductDeactivateConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        busy={deleteProductsMutation.isPending}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => {
          if (deactivateTarget === 'selected') {
            handleDeleteSelectedProducts();
          } else if (deactivateTarget) {
            deleteProductsMutation.mutate([deactivateTarget.id]);
          }
          setDeactivateTarget(null);
        }}
      />

      <Modal
        open={bulkSectionModal}
        onClose={() => setBulkSectionModal(false)}
        title={`${t('bulkAssignSections')} (${selectedProductIds.size})`}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {sections.length === 0 ? (
            <p className="text-noorix-muted text-[13px]">{t('sectionsEmpty')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-[12px] text-noorix-muted mb-1">{t('bulkSelectSections')}</div>
              {sections.map((s) => (
                <Checkbox
                  key={s.id}
                  checked={bulkSelectedSections.includes(s.id)}
                  onChange={(e) => {
                    if (e.target.checked) setBulkSelectedSections((prev) => [...prev, s.id]);
                    else setBulkSelectedSections((prev) => prev.filter((n) => n !== s.id));
                  }}
                  label={s.nameAr + (s.nameEn ? ` / ${s.nameEn}` : '')}
                  className="cursor-pointer"
                  containerClassName="cursor-pointer text-[13px]"
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Radio
              checked={bulkMode === 'replace'}
              onChange={() => setBulkMode('replace')}
              label={t('bulkModeReplace')}
              containerClassName="text-[12px] cursor-pointer"
            />
            <Radio
              checked={bulkMode === 'add'}
              onChange={() => setBulkMode('add')}
              label={t('bulkModeAdd')}
              containerClassName="text-[12px] cursor-pointer"
            />
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
        catalogUnits={catalogUnits}
        conversionTemplates={conversionTemplates}
        materialProducts={filterRecipeMaterialProducts(products, activeForm?.id)}
        saving={sheetMode === 'edit' ? updateProduct.isPending : createProduct.isPending}
        onClose={closeSheet}
        onSave={handleSave}
        onDelete={sheetMode === 'edit' && editingProduct?.id ? () => {
          if (editingProduct.id) setDeactivateTarget({ id: editingProduct.id });
        } : undefined}
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
          sectionsCount={sections.length}
          categoriesCount={categories.length}
          productsCount={totalOfType}
          onGoSections={() => setActiveSubTab('sections')}
          onGoCategories={() => setActiveSubTab('categories')}
          onImport={() => setShowImportModal(true)}
          onAddProduct={openCreateSheet}
        />

        <div className="nx-catalog-products-list flex flex-col gap-3 min-w-0 max-w-full">
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
            onDeactivateSelected={() => setDeactivateTarget('selected')}
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
          />
        </div>
      </div>
    </>
  );
}
