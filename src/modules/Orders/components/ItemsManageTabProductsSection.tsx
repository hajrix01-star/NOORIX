import React, { useState, useEffect } from 'react';
import { fmt } from '../../../utils/format';
import { OrdersImportHelpTrigger } from './OrdersImportHelpTrigger';
import { OrdersImportModal } from './OrdersImportModal';
import { Button, Input, Modal } from '../../../ui';
import { ItemsCatalogPrintModal } from './ItemsCatalogPrintModal';

/** Products sub-tab UI for `ItemsManageTab` (presentation + local layout only). */
export function ItemsManageTabProductsSection({ ctrl, productTypeFilter = 'order' }: any) {
  const {
    t,
    companyId,
    categories,
    sections,
    products,
    filteredProducts: _filteredAll,
    sizesOptions,
    packagingOptions,
    newProduct,
    setNewProduct,
    editingProduct,
    setEditingProduct,
    productSearchQuery,
    setProductSearchQuery,
    productFilterSection,
    setProductFilterSection,
    productFilterCategory,
    setProductFilterCategory,
    presetBusy,
    createProduct,
    createProductsBatch,
    createCategoriesBatch,
    handleInsertPresetCatalog,
    handleDownloadProductsImportTemplate,
    handleExportProducts,
    handleCreateProduct,
    handleUpdateProduct,
    addVariantToProduct,
    updateNewProductVariant,
    removeNewProductVariant,
    updateEditingVariant,
    removeEditingVariant,
    setAddSizeModal,
    setAddPackagingModal,
    selectedProductIds,
    toggleProductSelection,
    toggleAllProducts,
    handleDeleteSelectedProducts,
    deleteProductsMutation,
    bulkSetSections,
  } = ctrl;

  const [showImportModal, setShowImportModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [bulkSectionModal, setBulkSectionModal] = useState(false);
  const [bulkSelectedSections, setBulkSelectedSections] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<'replace' | 'add'>('replace');
  const [bulkBusy, setBulkBusy] = useState(false);

  async function handleBulkApply() {
    setBulkBusy(true);
    try {
      await bulkSetSections.mutateAsync({
        productIds: [...selectedProductIds],
        sectionNames: bulkSelectedSections,
        mode: bulkMode,
      });
      setBulkSectionModal(false);
      setBulkSelectedSections([]);
    } finally {
      setBulkBusy(false);
    }
  }

  const filteredProducts = _filteredAll.filter(
    (p: any) => (p.productType || 'order') === productTypeFilter
  );

  useEffect(() => {
    setNewProduct((p: any) => ({ ...p, productType: productTypeFilter }));
  }, [productTypeFilter]);

  const allFilteredIds = filteredProducts.map((p: any) => p.id);
  const allSelected = allFilteredIds.length > 0 && selectedProductIds.size === allFilteredIds.length;
  const someSelected = selectedProductIds.size > 0;

  return (
    <>
      <ItemsCatalogPrintModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        companyId={companyId}
        products={products}
        categories={categories}
        sections={sections}
        productTypeFilter={productTypeFilter}
        initialSection={productFilterSection}
        initialCategoryId={productFilterCategory}
      />

      {showImportModal && (
        <OrdersImportModal
          type="products"
          companyId={companyId}
          products={products}
          categories={categories}
          createProductsBatch={createProductsBatch}
          createCategoriesBatch={createCategoriesBatch}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {/* Modal الربط الجماعي بالأقسام */}
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
                    checked={bulkSelectedSections.includes(s.nameAr)}
                    onChange={(e) => {
                      if (e.target.checked) setBulkSelectedSections((prev) => [...prev, s.nameAr]);
                      else setBulkSelectedSections((prev) => prev.filter((n) => n !== s.nameAr));
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
            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkApply}
              disabled={bulkBusy}
            >
              {bulkBusy ? t('saving') : t('apply')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBulkSectionModal(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      </Modal>
    <div className="grid gap-5">
      <div className="noorix-surface-card p-4 lg:p-5">
        <div className="flex flex-col gap-3 mb-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="m-0 text-[15px]">+ {t('ordersAddProduct')}</h4>
            <OrdersImportHelpTrigger t={t} variant="products" />
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-2 w-max">
              <Button size="sm" variant="primary" onClick={handleInsertPresetCatalog} disabled={presetBusy || !companyId}>
                {presetBusy ? t('saving') : t('ordersPresetCatalogButton')}
              </Button>
              <Button size="sm" onClick={handleDownloadProductsImportTemplate}>
                {t('ordersDownloadImportTemplate')}
              </Button>
              <Button size="sm" onClick={() => setShowImportModal(true)} disabled={createProductsBatch.isPending}>
                {t('import')}
              </Button>
              <Button size="sm" onClick={handleExportProducts} disabled={products.length === 0}>
                {t('exportExcel')}
              </Button>
              <Button size="sm" onClick={() => setShowPrintModal(true)} disabled={products.length === 0}>
                {t('ordersPrintCatalog')}
              </Button>
            </div>
          </div>
          <p className="m-0 text-[11px] text-noorix-muted leading-[1.45]">{t('ordersPresetCatalogHint')}</p>
        </div>
        <div className="grid gap-4">
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
            <Input
              label={`${t('productNameAr')} *`}
              value={newProduct.nameAr}
              onChange={(e: any) => setNewProduct((p: any) => ({ ...p, nameAr: e.target.value }))}
              placeholder={t('productNameAr')}
            />
            <Input
              label={t('productNameEn')}
              value={newProduct.nameEn}
              onChange={(e: any) => setNewProduct((p: any) => ({ ...p, nameEn: e.target.value }))}
              placeholder={t('productNameEn')}
            />
            <Input
              type="select"
              label={t('category')}
              value={newProduct.categoryId}
              onChange={(e: any) => setNewProduct((p: any) => ({ ...p, categoryId: e.target.value }))}
            >
              <option value="">—</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr || c.nameEn || c.id}
                </option>
              ))}
            </Input>
            {/* productType hidden — determined by current tab (productTypeFilter) */}
            <input type="hidden" value={productTypeFilter} onChange={() => setNewProduct((p: any) => ({ ...p, productType: productTypeFilter }))} />
            {(sections as any[]).length > 0 && (
              <div>
                <div className="text-[12px] text-noorix-muted mb-1">{t('productSections')}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {(sections as any[]).map((s: any) => (
                    <label key={s.id} className="flex items-center gap-1 text-[12px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(newProduct.sectionsText || '').split(/[,،]/).map((x: string) => x.trim()).includes(s.nameAr)}
                        onChange={(e) => {
                          const cur = (newProduct.sectionsText || '').split(/[,،]/).map((x: string) => x.trim()).filter(Boolean);
                          const next = e.target.checked ? [...new Set([...cur, s.nameAr])] : cur.filter((n: string) => n !== s.nameAr);
                          setNewProduct((p: any) => ({ ...p, sectionsText: next.join('، ') }));
                        }}
                        className="cursor-pointer"
                      />
                      {s.nameAr}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] text-noorix-muted">{t('ordersProductVariants')}</label>
              <Button size="sm" onClick={addVariantToProduct}>
                + {t('ordersAddVariant')}
              </Button>
            </div>
            <div className="rounded-lg border border-noorix-border overflow-x-auto">
              <table className="w-full text-[12px] border-collapse" style={{ minWidth: '400px' }}>
                <thead>
                  <tr className="bg-noorix-bg-muted border-b border-noorix-border">
                    <th className="font-semibold text-right py-2 px-2.5">{t('ordersProductSize')}</th>
                    <th className="font-semibold text-right py-2 px-2.5">{t('ordersProductPackaging')}</th>
                    <th className="font-semibold text-right py-2 px-2.5">{t('unit')}</th>
                    <th className="font-semibold text-right py-2 px-2.5">{t('ordersVariantPrice')}</th>
                    <th className="w-10 py-2 px-1" />
                  </tr>
                </thead>
                <tbody>
                  {(newProduct.variants || []).map((v: any, idx: any) => (
                    <tr key={idx} className="border-b border-noorix-border">
                      <td className="py-1.5 px-2">
                        <div className="flex gap-1">
                          <Input type="select" value={v.size} onChange={(e: any) => updateNewProductVariant(idx, 'size', e.target.value)} className="flex-1 min-w-0">
                            <option value="">—</option>
                            {sizesOptions.map((s: any) => (
                              <option key={s.ar} value={s.ar}>
                                {s.ar}
                              </option>
                            ))}
                          </Input>
                          <Button size="sm" onClick={() => setAddSizeModal(true)} title={t('add')}>
                            +
                          </Button>
                        </div>
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="flex gap-1">
                          <Input type="select" value={v.packaging} onChange={(e: any) => updateNewProductVariant(idx, 'packaging', e.target.value)} className="flex-1 min-w-0">
                            <option value="">—</option>
                            {packagingOptions.map((s: any) => (
                              <option key={s.ar} value={s.ar}>
                                {s.ar}
                              </option>
                            ))}
                          </Input>
                          <Button size="sm" onClick={() => setAddPackagingModal(true)} title={t('add')}>
                            +
                          </Button>
                        </div>
                      </td>
                      <td className="py-1.5 px-2">
                        <Input type="select" value={v.unit} onChange={(e: any) => updateNewProductVariant(idx, 'unit', e.target.value)}>
                          <option value="piece">{t('ordersUnitPiece')}</option>
                          <option value="kg">{t('ordersUnitKg')}</option>
                          <option value="box">{t('ordersUnitBox')}</option>
                          <option value="dozen">{t('ordersUnitDozen')}</option>
                        </Input>
                      </td>
                      <td className="py-1.5 px-2">
                        <Input type="number" min="0" step="0.01" value={v.lastPrice} onChange={(e: any) => updateNewProductVariant(idx, 'lastPrice', e.target.value)} placeholder="0" className="w-20" />
                      </td>
                      <td className="py-1.5 px-1">
                        <Button size="sm" variant="danger" onClick={() => removeNewProductVariant(idx)}>
                          ×
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <Button variant="primary" onClick={handleCreateProduct} disabled={createProduct.isPending || !companyId}>
              {createProduct.isPending ? t('saving') : t('add')}
            </Button>
          </div>
        </div>
      </div>

      <div className="noorix-surface-card overflow-auto">
        {/* شريط الأدوات العلوي */}
        <div className="nx-section-header justify-between gap-2 flex-wrap">
          {someSelected ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setBulkSelectedSections([]); setBulkSectionModal(true); }}
              >
                {t('bulkAssignSections')} ({selectedProductIds.size})
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={handleDeleteSelectedProducts}
                disabled={deleteProductsMutation.isPending}
              >
                {deleteProductsMutation.isPending
                  ? t('saving')
                  : `${t('ordersDeleteSelected')} (${selectedProductIds.size})`}
              </Button>
            </div>
          ) : (
            <span />
          )}
          <Input
            type="search"
            value={productSearchQuery}
            onChange={(e: any) => setProductSearchQuery(e.target.value)}
            placeholder={t('ordersSearchProducts')}
            aria-label={t('ordersSearchProducts')}
            className="max-w-[220px]"
          />
        </div>

        {/* شريط الفلاتر */}
        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
          {/* فلتر الأقسام */}
          <Input
            type="select"
            value={productFilterSection}
            onChange={(e: any) => setProductFilterSection(e.target.value)}
            className="min-w-[160px]"
          >
            <option value="">{t('filterAllSections')}</option>
            <option value="__none__">{t('filterNoSection')}</option>
            {(sections as any[]).map((s: any) => (
              <option key={s.id} value={s.nameAr}>{s.nameAr}{s.nameEn ? ` / ${s.nameEn}` : ''}</option>
            ))}
          </Input>

          {/* فلتر الفئة */}
          <Input
            type="select"
            value={productFilterCategory}
            onChange={(e: any) => setProductFilterCategory(e.target.value)}
            className="min-w-[160px]"
          >
            <option value="">{t('filterAllCategories')}</option>
            {(categories as any[]).map((c: any) => (
              <option key={c.id} value={c.id}>{c.nameAr || c.nameEn}</option>
            ))}
          </Input>

          {/* زر إعادة الضبط */}
          {(productFilterSection || productFilterCategory) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setProductFilterSection(''); setProductFilterCategory(''); }}
            >
              ✕ {t('clearFilters')}
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setShowPrintModal(true)}
            disabled={filteredProducts.length === 0}
          >
            {t('ordersPrintCatalog')}
          </Button>

          {/* عداد النتائج */}
          <span className="text-[12px] text-noorix-muted ms-auto">
            {filteredProducts.length} / {products.filter((p: any) => (p.productType || 'order') === productTypeFilter).length}
          </span>
        </div>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b-2 border-noorix-border">
              <th className="py-[10px] px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => toggleAllProducts(allFilteredIds)}
                  aria-label={t('ordersSelectAll')}
                  className="cursor-pointer"
                />
              </th>
              <th className="font-bold text-right py-[10px] px-3">{t('productNameAr')}</th>
              <th className="font-bold text-right py-[10px] px-3">{t('productNameEn')}</th>
              <th className="font-bold text-right py-[10px] px-3">{t('category')}</th>
              <th className="font-bold text-right py-[10px] px-3">{t('productSections')}</th>
              <th className="font-bold text-right py-[10px] px-3">{t('ordersProductVariants')}</th>
              <th className="text-center font-bold py-[10px] px-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p: any) => {
              const variants = Array.isArray(p.variants) ? p.variants : [];
              const variantsSummary =
                variants.length > 0
                  ? variants.map((v: any) => `${v.size || '—'}/${v.packaging || '—'}/${v.unit || 'piece'}: ${fmt(v.lastPrice ?? 0)}`).join(' | ')
                  : p.lastPrice
                    ? String(fmt(p.lastPrice))
                    : '';
              return (
                <tr
                  key={p.id}
                  className={`border-b border-noorix-border${selectedProductIds.has(p.id) ? ' bg-noorix-bg-muted' : ''}`}
                >
                  {editingProduct?.id === p.id ? (
                    <>
                      <td className="py-2 px-3 text-center">
                        <input type="checkbox" checked={selectedProductIds.has(p.id)} onChange={() => toggleProductSelection(p.id)} className="cursor-pointer" />
                      </td>
                      <td className="py-2 px-3" colSpan={5}>
                        <div className="grid gap-3">
                          <div className="flex flex-wrap gap-3">
                            <div className="min-w-[140px]">
                              <label className="text-[11px] text-noorix-muted">{t('productNameAr')}</label>
                              <Input type="text" value={editingProduct.nameAr} onChange={(e: any) => setEditingProduct((x: any) => ({ ...x, nameAr: e.target.value }))} />
                            </div>
                            <div className="min-w-[140px]">
                              <label className="text-[11px] text-noorix-muted">{t('productNameEn')}</label>
                              <Input type="text" value={editingProduct.nameEn || ''} onChange={(e: any) => setEditingProduct((x: any) => ({ ...x, nameEn: e.target.value }))} />
                            </div>
                            <div className="min-w-[120px]">
                              <label className="text-[11px] text-noorix-muted">{t('category')}</label>
                              <Input type="select" value={editingProduct.categoryId || ''} onChange={(e: any) => setEditingProduct((x: any) => ({ ...x, categoryId: e.target.value }))}>
                                <option value="">—</option>
                                {categories.map((c: any) => (
                                  <option key={c.id} value={c.id}>
                                    {c.nameAr || c.nameEn}
                                  </option>
                                ))}
                              </Input>
                            </div>
                            {/* productType locked to current tab */}
                            {(sections as any[]).length > 0 && (
                              <div className="min-w-[160px]">
                                <div className="text-[11px] text-noorix-muted mb-1">{t('productSections')}</div>
                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                  {(sections as any[]).map((s: any) => {
                                    const cur = (editingProduct.sectionsText || '').split(/[,،]/).map((x: string) => x.trim()).filter(Boolean);
                                    return (
                                      <label key={s.id} className="flex items-center gap-1 text-[12px] cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={cur.includes(s.nameAr)}
                                          onChange={(e) => {
                                            const next = e.target.checked ? [...new Set([...cur, s.nameAr])] : cur.filter((n: string) => n !== s.nameAr);
                                            setEditingProduct((x: any) => ({ ...x, sectionsText: next.join('، ') }));
                                          }}
                                          className="cursor-pointer"
                                        />
                                        {s.nameAr}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-[11px] text-noorix-muted">{t('ordersProductVariants')}</label>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setEditingProduct((x: any) => ({
                                    ...x,
                                    variants: [...(x.variants || []), { size: '', packaging: '', unit: 'piece', lastPrice: '' }],
                                  }))
                                }
                              >
                                + {t('ordersAddVariant')}
                              </Button>
                            </div>
                            <div className="border border-noorix-border overflow-auto rounded-[6px]">
                              <table className="w-full text-[11px] border-collapse">
                                <thead>
                                  <tr className="bg-noorix-bg-muted">
                                    <th className="text-right py-1.5 px-2">{t('ordersProductSize')}</th>
                                    <th className="text-right py-1.5 px-2">{t('ordersProductPackaging')}</th>
                                    <th className="text-right py-1.5 px-2">{t('unit')}</th>
                                    <th className="text-right py-1.5 px-2">{t('ordersVariantPrice')}</th>
                                    <th className="w-9" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {(editingProduct.variants || []).map((v: any, idx: any) => (
                                    <tr key={idx}>
                                      <td className="py-1 px-1.5">
                                        <Input type="select" value={v.size} onChange={(e: any) => updateEditingVariant(idx, 'size', e.target.value)}>
                                          <option value="">—</option>
                                          {sizesOptions.map((s: any) => (
                                            <option key={s.ar} value={s.ar}>
                                              {s.ar}
                                            </option>
                                          ))}
                                        </Input>
                                      </td>
                                      <td className="py-1 px-1.5">
                                        <Input type="select" value={v.packaging} onChange={(e: any) => updateEditingVariant(idx, 'packaging', e.target.value)}>
                                          <option value="">—</option>
                                          {packagingOptions.map((s: any) => (
                                            <option key={s.ar} value={s.ar}>
                                              {s.ar}
                                            </option>
                                          ))}
                                        </Input>
                                      </td>
                                      <td className="py-1 px-1.5">
                                        <Input type="select" value={v.unit} onChange={(e: any) => updateEditingVariant(idx, 'unit', e.target.value)}>
                                          <option value="piece">{t('ordersUnitPiece')}</option>
                                          <option value="kg">{t('ordersUnitKg')}</option>
                                          <option value="box">{t('ordersUnitBox')}</option>
                                          <option value="dozen">{t('ordersUnitDozen')}</option>
                                        </Input>
                                      </td>
                                      <td className="py-1 px-1.5">
                                        <Input type="number" min="0" step="0.01" value={v.lastPrice} onChange={(e: any) => updateEditingVariant(idx, 'lastPrice', e.target.value)} className="w-[70px]" />
                                      </td>
                                      <td className="p-1">
                                        <Button size="sm" variant="danger" onClick={() => removeEditingVariant(idx)}>
                                          ×
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div className="nx-toolbar">
                            <Button size="sm" variant="primary" onClick={handleUpdateProduct}>
                              {t('save')}
                            </Button>
                            <Button size="sm" onClick={() => setEditingProduct(null)}>
                              {t('cancel')}
                            </Button>
                          </div>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-[10px] px-3 text-center">
                        <input type="checkbox" checked={selectedProductIds.has(p.id)} onChange={() => toggleProductSelection(p.id)} className="cursor-pointer" />
                      </td>
                      <td className="py-[10px] px-3">{p.nameAr || '—'}</td>
                      <td className="nx-cell-muted py-[10px] px-3">{p.nameEn || '—'}</td>
                      <td className="nx-cell-muted py-[10px] px-3">{p.category?.nameAr || p.category?.nameEn || '—'}</td>
                      <td className="nx-cell-muted py-[10px] px-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${(p as any).productType === 'sale' ? 'bg-green-100 text-noorix-green' : 'bg-blue-100 text-noorix-blue'}`}>
                          {(p as any).productType === 'sale' ? t('productTypeSale') : t('productTypeOrder')}
                        </span>
                      </td>
                      <td className="nx-cell-muted py-[10px] px-3 text-[12px]">
                        {Array.isArray(p.sections) && p.sections.length > 0 ? (p.sections as string[]).join(' · ') : <span className="text-noorix-muted opacity-50">—</span>}
                      </td>
                      <td className="nx-cell-ellipsis nx-cell-muted py-[10px] px-3 text-[12px] max-w-[280px]" title={variantsSummary}>
                        {variantsSummary}
                      </td>
                      <td className="text-center py-[10px] px-3">
                        <Button
                          size="sm"
                          onClick={() =>
                            setEditingProduct({
                              id: p.id,
                              nameAr: p.nameAr,
                              nameEn: p.nameEn || '',
                              categoryId: p.categoryId || '',
                              sectionsText: Array.isArray(p.sections) ? (p.sections as string[]).join('، ') : '',
                              productType: (p as any).productType || 'order',
                              variants:
                                variants.length > 0
                                  ? variants.map((v: any) => ({
                                      size: v.size || '',
                                      packaging: v.packaging || '',
                                      unit: v.unit || 'piece',
                                      lastPrice: v.lastPrice ? String(v.lastPrice) : '',
                                    }))
                                  : [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }],
                            })
                          }
                        >
                          {t('edit')}
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && <div className="text-center text-noorix-muted p-[30px]">{t('ordersNoProductsYet')}</div>}
        {products.length > 0 && filteredProducts.length === 0 && <div className="text-center text-noorix-muted p-[30px]">{t('ordersNoSearchResults')}</div>}
      </div>
    </div>
    </>
  );
}
