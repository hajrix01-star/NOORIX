import React from 'react';
import { fmt } from '../../../utils/format';
import { OrdersImportHelpTrigger } from './OrdersImportHelpTrigger';
import { Button, Input } from '../../../ui';

/** Products sub-tab UI for `ItemsManageTab` (presentation + local layout only). */
export function ItemsManageTabProductsSection({ ctrl }) {
  const {
    t,
    companyId,
    categories,
    products,
    filteredProducts,
    sizesOptions,
    packagingOptions,
    newProduct,
    setNewProduct,
    editingProduct,
    setEditingProduct,
    productSearchQuery,
    setProductSearchQuery,
    fileInputProducts,
    presetBusy,
    createProduct,
    createProductsBatch,
    handleInsertPresetCatalog,
    handleDownloadProductsImportTemplate,
    handleImportProducts,
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
  } = ctrl;

  return (
    <div className="grid gap-5">
      <div className="noorix-surface-card p-4 lg:p-5">
        <div className="flex flex-col gap-3 mb-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="m-0 text-[15px]">+ {t('ordersAddProduct')}</h4>
            <OrdersImportHelpTrigger t={t} variant="products" />
          </div>
          <input ref={fileInputProducts} type="file" accept=".xlsx,.xls" onChange={handleImportProducts} className="hidden" />
          <div className="overflow-x-auto">
            <div className="flex gap-2 w-max">
              <Button size="sm" variant="primary" onClick={handleInsertPresetCatalog} disabled={presetBusy || !companyId}>
                {presetBusy ? t('saving') : t('ordersPresetCatalogButton')}
              </Button>
              <Button size="sm" onClick={handleDownloadProductsImportTemplate}>
                {t('ordersDownloadImportTemplate')}
              </Button>
              <Button size="sm" onClick={() => fileInputProducts.current?.click()} disabled={createProductsBatch.isPending}>
                {t('import')}
              </Button>
              <Button size="sm" onClick={handleExportProducts} disabled={products.length === 0}>
                {t('exportExcel')}
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
              onChange={(e) => setNewProduct((p) => ({ ...p, nameAr: e.target.value }))}
              placeholder={t('productNameAr')}
            />
            <Input
              label={t('productNameEn')}
              value={newProduct.nameEn}
              onChange={(e) => setNewProduct((p) => ({ ...p, nameEn: e.target.value }))}
              placeholder={t('productNameEn')}
            />
            <Input
              type="select"
              label={t('category')}
              value={newProduct.categoryId}
              onChange={(e) => setNewProduct((p) => ({ ...p, categoryId: e.target.value }))}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr || c.nameEn || c.id}
                </option>
              ))}
            </Input>
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
                  {(newProduct.variants || []).map((v, idx) => (
                    <tr key={idx} className="border-b border-noorix-border">
                      <td className="py-1.5 px-2">
                        <div className="flex gap-1">
                          <Input type="select" value={v.size} onChange={(e) => updateNewProductVariant(idx, 'size', e.target.value)} className="flex-1 min-w-0">
                            <option value="">—</option>
                            {sizesOptions.map((s) => (
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
                          <Input type="select" value={v.packaging} onChange={(e) => updateNewProductVariant(idx, 'packaging', e.target.value)} className="flex-1 min-w-0">
                            <option value="">—</option>
                            {packagingOptions.map((s) => (
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
                        <Input type="select" value={v.unit} onChange={(e) => updateNewProductVariant(idx, 'unit', e.target.value)}>
                          <option value="piece">{t('ordersUnitPiece')}</option>
                          <option value="kg">{t('ordersUnitKg')}</option>
                          <option value="box">{t('ordersUnitBox')}</option>
                          <option value="dozen">{t('ordersUnitDozen')}</option>
                        </Input>
                      </td>
                      <td className="py-1.5 px-2">
                        <Input type="number" min="0" step="0.01" value={v.lastPrice} onChange={(e) => updateNewProductVariant(idx, 'lastPrice', e.target.value)} placeholder="0" className="w-20" />
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
        <div className="nx-section-header justify-end">
          <Input
            type="search"
            value={productSearchQuery}
            onChange={(e) => setProductSearchQuery(e.target.value)}
            placeholder={t('ordersSearchProducts')}
            aria-label={t('ordersSearchProducts')}
            className="max-w-[320px]"
          />
        </div>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b-2 border-noorix-border">
              <th className="font-bold text-right py-[10px] px-3">{t('productNameAr')}</th>
              <th className="font-bold text-right py-[10px] px-3">{t('productNameEn')}</th>
              <th className="font-bold text-right py-[10px] px-3">{t('category')}</th>
              <th className="font-bold text-right py-[10px] px-3">{t('ordersProductVariants')}</th>
              <th className="text-center font-bold py-[10px] px-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => {
              const variants = Array.isArray(p.variants) ? p.variants : [];
              const variantsSummary =
                variants.length > 0
                  ? variants.map((v) => `${v.size || '—'}/${v.packaging || '—'}/${v.unit || 'piece'}: ${fmt(v.lastPrice ?? 0)}`).join(' | ')
                  : p.lastPrice
                    ? String(fmt(p.lastPrice))
                    : '';
              return (
                <tr key={p.id} className="border-b border-noorix-border">
                  {editingProduct?.id === p.id ? (
                    <>
                      <td className="py-2 px-3" colSpan={5}>
                        <div className="grid gap-3">
                          <div className="flex flex-wrap gap-3">
                            <div className="min-w-[140px]">
                              <label className="text-[11px] text-noorix-muted">{t('productNameAr')}</label>
                              <Input type="text" value={editingProduct.nameAr} onChange={(e) => setEditingProduct((x) => ({ ...x, nameAr: e.target.value }))} />
                            </div>
                            <div className="min-w-[140px]">
                              <label className="text-[11px] text-noorix-muted">{t('productNameEn')}</label>
                              <Input type="text" value={editingProduct.nameEn || ''} onChange={(e) => setEditingProduct((x) => ({ ...x, nameEn: e.target.value }))} />
                            </div>
                            <div className="min-w-[120px]">
                              <label className="text-[11px] text-noorix-muted">{t('category')}</label>
                              <Input type="select" value={editingProduct.categoryId || ''} onChange={(e) => setEditingProduct((x) => ({ ...x, categoryId: e.target.value }))}>
                                <option value="">—</option>
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.nameAr || c.nameEn}
                                  </option>
                                ))}
                              </Input>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-[11px] text-noorix-muted">{t('ordersProductVariants')}</label>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setEditingProduct((x) => ({
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
                                  {(editingProduct.variants || []).map((v, idx) => (
                                    <tr key={idx}>
                                      <td className="py-1 px-1.5">
                                        <Input type="select" value={v.size} onChange={(e) => updateEditingVariant(idx, 'size', e.target.value)}>
                                          <option value="">—</option>
                                          {sizesOptions.map((s) => (
                                            <option key={s.ar} value={s.ar}>
                                              {s.ar}
                                            </option>
                                          ))}
                                        </Input>
                                      </td>
                                      <td className="py-1 px-1.5">
                                        <Input type="select" value={v.packaging} onChange={(e) => updateEditingVariant(idx, 'packaging', e.target.value)}>
                                          <option value="">—</option>
                                          {packagingOptions.map((s) => (
                                            <option key={s.ar} value={s.ar}>
                                              {s.ar}
                                            </option>
                                          ))}
                                        </Input>
                                      </td>
                                      <td className="py-1 px-1.5">
                                        <Input type="select" value={v.unit} onChange={(e) => updateEditingVariant(idx, 'unit', e.target.value)}>
                                          <option value="piece">{t('ordersUnitPiece')}</option>
                                          <option value="kg">{t('ordersUnitKg')}</option>
                                          <option value="box">{t('ordersUnitBox')}</option>
                                          <option value="dozen">{t('ordersUnitDozen')}</option>
                                        </Input>
                                      </td>
                                      <td className="py-1 px-1.5">
                                        <Input type="number" min="0" step="0.01" value={v.lastPrice} onChange={(e) => updateEditingVariant(idx, 'lastPrice', e.target.value)} className="w-[70px]" />
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
                      <td className="py-[10px] px-3">{p.nameAr || '—'}</td>
                      <td className="nx-cell-muted py-[10px] px-3">{p.nameEn || '—'}</td>
                      <td className="nx-cell-muted py-[10px] px-3">{p.category?.nameAr || p.category?.nameEn || '—'}</td>
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
                              variants:
                                variants.length > 0
                                  ? variants.map((v) => ({
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
  );
}
