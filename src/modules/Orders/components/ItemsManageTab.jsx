/**
 * ItemsManageTab � ������ ����� ������� �������
 * ����� ���� �� ����� ������ ������� �������� + ���� ����� ����
 */
import React, { useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  useOrderProducts,
  useOrderCategories,
  useCreateOrderProductMutation,
  useCreateOrderProductsBatchMutation,
  useUpdateOrderProductMutation,
  useCreateOrderCategoryMutation,
  useCreateOrderCategoriesBatchMutation,
  useUpdateOrderCategoryMutation,
} from '../../../hooks/useOrders';
import { fmt } from '../../../utils/format';
import {
  importFromExcel,
  exportOrdersProductsImportTemplate,
  exportOrdersCategoriesImportTemplate,
  exportOrderProductsWorkbook,
  exportOrderCategoriesWorkbook,
  filterOrderProductsTemplateRows,
  filterOrderCategoriesTemplateRows,
  groupOrderProductImportRows,
  orderProductImportGroupsToPayload,
} from '../../../utils/exportUtils';
import { useToast } from '../../../context/ToastContext';
import {
  getSizesOptions,
  getPackagingOptions,
  addCustomSize,
  addCustomPackaging,
} from '../constants/orderDefaults';
import { AddSizeModal } from './AddSizeModal';
import { AddPackagingModal } from './AddPackagingModal';
import { OrdersImportHelpTrigger } from './OrdersImportHelpTrigger';
import { BROASTED_PRESET_ORDER_PRODUCTS, presetRowToProductPayload } from '../data/broastedPresetCatalog';
import {
  getOrderCategories,
  getOrderProducts,
  createOrderCategoriesBatch,
  createOrderProductsBatch,
  updateOrderProduct,
} from '../../../services/api';
import { Button, Input } from '../../../ui';
import { assertApiOk } from '../../../utils/apiResponse';

export function ItemsManageTab({ companyId }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('products');
  const { showToast } = useToast();
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newProduct, setNewProduct] = useState({ nameAr: '', nameEn: '', categoryId: '', variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }] });
  const [newCategory, setNewCategory] = useState({ nameAr: '', nameEn: '' });
  const [addSizeModal, setAddSizeModal] = useState(false);
  const [addPackagingModal, setAddPackagingModal] = useState(false);
  const [newSize, setNewSize] = useState({ ar: '', en: '' });
  const [newPackaging, setNewPackaging] = useState({ ar: '', en: '' });
  const [sizesKey, setSizesKey] = useState(0);
  const [packagingKey, setPackagingKey] = useState(0);
  const [presetBusy, setPresetBusy] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  const { data: products = [] } = useOrderProducts(companyId);
  const { data: categories = [] } = useOrderCategories(companyId);
  const createProduct = useCreateOrderProductMutation(companyId);
  const createProductsBatch = useCreateOrderProductsBatchMutation(companyId);
  const updateProduct = useUpdateOrderProductMutation(companyId);
  const createCategory = useCreateOrderCategoryMutation(companyId);
  const createCategoriesBatch = useCreateOrderCategoriesBatchMutation(companyId);
  const updateCategory = useUpdateOrderCategoryMutation(companyId);
  const fileInputProducts = useRef(null);
  const fileInputCategories = useRef(null);

  const sizesOptions = useMemo(() => getSizesOptions(companyId || ''), [companyId, sizesKey]);
  const packagingOptions = useMemo(() => getPackagingOptions(companyId || ''), [companyId, packagingKey]);

  const filteredProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const cat = `${p.category?.nameAr || ''} ${p.category?.nameEn || ''}`.toLowerCase();
      const na = String(p.nameAr || '').toLowerCase();
      const ne = String(p.nameEn || '').toLowerCase();
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const vtxt = variants
        .map((v) => `${v.size || ''} ${v.packaging || ''} ${v.unit || ''} ${v.lastPrice ?? ''}`)
        .join(' ')
        .toLowerCase();
      return na.includes(q) || ne.includes(q) || cat.includes(q) || vtxt.includes(q);
    });
  }, [products, productSearchQuery]);

  const filteredCategories = useMemo(() => {
    const q = categorySearchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => {
      const na = String(c.nameAr || '').toLowerCase();
      const ne = String(c.nameEn || '').toLowerCase();
      return na.includes(q) || ne.includes(q);
    });
  }, [categories, categorySearchQuery]);

  function handleCreateProduct() {
    if (!newProduct.nameAr?.trim()) {
      showToast(t('ordersProductNameRequired'), 'error');
      return;
    }
    const validVariants = (newProduct.variants || []).filter((v) => v.size || v.packaging || v.unit || parseFloat(v.lastPrice) > 0);
    const payload = {
      companyId,
      nameAr: newProduct.nameAr.trim(),
      nameEn: newProduct.nameEn?.trim() || undefined,
      categoryId: newProduct.categoryId || undefined,
      variants: validVariants.length > 0 ? validVariants.map((v) => ({ size: v.size || '', packaging: v.packaging || '', unit: v.unit || 'piece', lastPrice: v.lastPrice || '0' })) : undefined,
    };
    createProduct.mutate(payload, {
      onSuccess: () => {
        showToast(t('ordersProductAdded'), 'success');
        setNewProduct({ nameAr: '', nameEn: '', categoryId: '', variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }] });
      },
      onError: (e) => {
        showToast(e?.message || e?.error || t('addFailed'), 'error');
      },
    });
  }

  function handleUpdateProduct() {
    if (!editingProduct?.id) return;
    const validVariants = (editingProduct.variants || []).filter((v) => v.size || v.packaging || v.unit || parseFloat(v.lastPrice) > 0);
    const body = {
      nameAr: editingProduct.nameAr,
      nameEn: editingProduct.nameEn ?? null,
      categoryId: editingProduct.categoryId || null,
      variants: validVariants.length > 0 ? validVariants.map((v) => ({ size: v.size || '', packaging: v.packaging || '', unit: v.unit || 'piece', lastPrice: v.lastPrice || '0' })) : [],
    };
    updateProduct.mutate(
      { id: editingProduct.id, body },
      {
        onSuccess: () => {
          showToast(t('ordersProductUpdated'), 'success');
          setEditingProduct(null);
        },
        onError: (e) => {
          showToast(e?.message || e?.error || t('updateFailed'), 'error');
        },
      },
    );
  }

  function handleCreateCategory() {
    if (!newCategory.nameAr?.trim()) {
      showToast(t('ordersCategoryNameRequired'), 'error');
      return;
    }
    createCategory.mutate(
      { companyId, nameAr: newCategory.nameAr.trim(), nameEn: newCategory.nameEn?.trim() || undefined },
      {
        onSuccess: () => {
          showToast(t('ordersCategoryAdded'), 'success');
          setNewCategory({ nameAr: '', nameEn: '' });
        },
        onError: (e) => showToast(e?.message || t('addFailed'), 'error'),
      },
    );
  }

  function handleAddSize() {
    const ar = (newSize.ar || '').trim();
    if (!ar) {
      showToast(t('ordersSizeNameRequired') || '��� ����� �������� �����', 'error');
      return;
    }
    addCustomSize(companyId, ar, newSize.en);
    setSizesKey((k) => k + 1);
    setNewSize({ ar: '', en: '' });
    setAddSizeModal(false);
    showToast(t('ordersSizeAdded') || '��� ����� �����', 'success');
  }

  function handleAddPackaging() {
    const ar = (newPackaging.ar || '').trim();
    if (!ar) {
      showToast(t('ordersPackagingNameRequired') || '��� ������� �������� �����', 'error');
      return;
    }
    addCustomPackaging(companyId, ar, newPackaging.en);
    setPackagingKey((k) => k + 1);
    setNewPackaging({ ar: '', en: '' });
    setAddPackagingModal(false);
    showToast(t('ordersPackagingAdded') || '��� ����� �������', 'success');
  }

  async function handleInsertPresetCatalog() {
    if (!companyId || presetBusy) return;
    setPresetBusy(true);
    try {
      let catRes = await getOrderCategories(companyId);
      const catMap = new Map((catRes?.data ?? []).map((c) => [String(c.nameAr ?? '').trim().toLowerCase(), c.id]));
      const presetCategoryNames = [...new Set(BROASTED_PRESET_ORDER_PRODUCTS.map((p) => p.categoryAr))];
      const missingCats = presetCategoryNames.filter((n) => !catMap.has(String(n).trim().toLowerCase()));
      let catsAdded = 0;
      if (missingCats.length) {
        const batchRes = await createOrderCategoriesBatch(companyId, missingCats.map((nameAr) => ({ nameAr })));
        assertApiOk(batchRes, t('addFailed'));
        catsAdded = missingCats.length;
        catRes = await getOrderCategories(companyId);
        (catRes?.data ?? []).forEach((c) => catMap.set(String(c.nameAr ?? '').trim().toLowerCase(), c.id));
      }

      const prodRes = await getOrderProducts(companyId);
      const productList = prodRes?.data ?? [];
      const byNameLower = new Map(productList.map((p) => [String(p.nameAr ?? '').trim().toLowerCase(), p]));

      const updateTasks = [];
      for (const row of BROASTED_PRESET_ORDER_PRODUCTS) {
        const key = row.nameAr.trim().toLowerCase();
        const ex = byNameLower.get(key);
        if (!ex) continue;
        const cid = catMap.get(row.categoryAr.trim().toLowerCase());
        const { variants, lastPrice, unit } = presetRowToProductPayload(row);
        updateTasks.push({
          id: ex.id,
          body: { categoryId: cid ?? null, variants, lastPrice, unit },
        });
      }

      const CHUNK = 6;
      let updated = 0;
      for (let i = 0; i < updateTasks.length; i += CHUNK) {
        const chunk = updateTasks.slice(i, i + CHUNK);
        const results = await Promise.all(chunk.map(({ id, body }) => updateOrderProduct(id, body, companyId)));
        for (const r of results) {
          assertApiOk(r, t('updateFailed'));
        }
        updated += chunk.length;
      }

      const existingKeys = new Set(productList.map((p) => String(p.nameAr ?? '').trim().toLowerCase()));
      const productsPayload = BROASTED_PRESET_ORDER_PRODUCTS.filter((p) => !existingKeys.has(p.nameAr.trim().toLowerCase())).map((p) => {
        const { variants, lastPrice, unit } = presetRowToProductPayload(p);
        return {
          nameAr: p.nameAr,
          categoryId: catMap.get(p.categoryAr.trim().toLowerCase()) || undefined,
          variants,
          lastPrice,
          unit,
        };
      });

      let added = 0;
      if (productsPayload.length) {
        const batchRes = await createOrderProductsBatch(companyId, productsPayload);
        assertApiOk(batchRes, t('addFailed'));
        added = productsPayload.length;
      }

      queryClient.invalidateQueries({ queryKey: ['order-products', companyId] });
      queryClient.invalidateQueries({ queryKey: ['order-categories', companyId] });

      if (added === 0 && updated === 0 && catsAdded === 0) {
        showToast(t('ordersPresetNothingDone'), 'success');
      } else {
        showToast(t('ordersPresetDone', String(added), String(updated), String(catsAdded)), 'success');
      }
    } catch (e) {
      showToast(e?.message || t('addFailed'), 'error');
    } finally {
      setPresetBusy(false);
    }
  }

  async function handleDownloadProductsImportTemplate() {
    try {
      await exportOrdersProductsImportTemplate('order-products-import-template.xlsx');
      showToast(t('ordersImportTemplateReady'), 'success');
    } catch (e) {
      showToast(e?.message || t('exportFailed'), 'error');
    }
  }

  async function handleDownloadCategoriesImportTemplate() {
    try {
      await exportOrdersCategoriesImportTemplate('order-categories-import-template.xlsx');
      showToast(t('ordersImportTemplateReady'), 'success');
    } catch (e) {
      showToast(e?.message || t('exportFailed'), 'error');
    }
  }

  async function handleExportProducts() {
    try {
      await exportOrderProductsWorkbook(products, 'order-products.xlsx');
      showToast(t('exportSuccess'), 'success');
    } catch (e) {
      showToast(e?.message || t('exportFailed'), 'error');
    }
  }

  async function handleExportCategories() {
    try {
      await exportOrderCategoriesWorkbook(categories, 'order-categories.xlsx');
      showToast(t('exportSuccess'), 'success');
    } catch (e) {
      showToast(e?.message || t('exportFailed'), 'error');
    }
  }

  async function handleImportProducts(e) {
    const file = e?.target?.files?.[0];
    if (!file) return;
    try {
      const rawRows = await importFromExcel(file);
      const filtered = filterOrderProductsTemplateRows(rawRows);
      const catByName = new Map(categories.map((c) => [String(c.nameAr ?? '').trim().toLowerCase(), c.id]));
      const groups = groupOrderProductImportRows(filtered);
      const toCreate = orderProductImportGroupsToPayload(groups, catByName);
      if (toCreate.length === 0) {
        showToast(t('ordersImportNoValidRows'), 'error');
        return;
      }
      createProductsBatch.mutate(toCreate, {
        onSuccess: (data) => {
          showToast(t('ordersImportSuccess', data?.length ?? toCreate.length), 'success');
          if (fileInputProducts.current) fileInputProducts.current.value = '';
        },
        onError: (err) => showToast(err?.message || err?.error || t('importFailed'), 'error'),
      });
    } catch (err) {
      showToast(err?.message || t('importFailed'), 'error');
    }
  }

  async function handleImportCategories(e) {
    const file = e?.target?.files?.[0];
    if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const filtered = filterOrderCategoriesTemplateRows(rows);
      const toCreate = filtered
        .filter((r) => r.nameAr || r.name_ar)
        .map((r) => ({
          nameAr: String(r.nameAr ?? r.name_ar ?? '').trim(),
          nameEn: String(r.nameEn ?? r.name_en ?? '').trim() || undefined,
        }))
        .filter((r) => r.nameAr);
      if (toCreate.length === 0) {
        showToast(t('ordersImportNoValidRows'), 'error');
        return;
      }
      createCategoriesBatch.mutate(toCreate, {
        onSuccess: (data) => {
          showToast(t('ordersImportSuccess', data?.length ?? toCreate.length), 'success');
          if (fileInputCategories.current) fileInputCategories.current.value = '';
        },
        onError: (err) => showToast(err?.message || t('importFailed'), 'error'),
      });
    } catch (err) {
      showToast(err?.message || t('importFailed'), 'error');
    }
  }

  function handleUpdateCategory() {
    if (!editingCategory?.id) return;
    updateCategory.mutate(
      { id: editingCategory.id, body: { nameAr: editingCategory.nameAr, nameEn: editingCategory.nameEn ?? null } },
      {
        onSuccess: () => {
          showToast(t('ordersCategoryUpdated'), 'success');
          setEditingCategory(null);
        },
        onError: (e) => showToast(e?.message || t('updateFailed'), 'error'),
      },
    );
  }

  function addVariantToProduct() {
    setNewProduct((p) => ({ ...p, variants: [...(p.variants || []), { size: '', packaging: '', unit: 'piece', lastPrice: '' }] }));
  }

  function updateNewProductVariant(idx, field, value) {
    setNewProduct((p) => {
      const v = [...(p.variants || [])];
      if (!v[idx]) return p;
      v[idx] = { ...v[idx], [field]: value };
      return { ...p, variants: v };
    });
  }

  function removeNewProductVariant(idx) {
    setNewProduct((p) => ({ ...p, variants: (p.variants || []).filter((_, i) => i !== idx) }));
  }

  function updateEditingVariant(idx, field, value) {
    setEditingProduct((p) => {
      const v = [...(p.variants || [])];
      if (!v[idx]) return p;
      v[idx] = { ...v[idx], [field]: value };
      return { ...p, variants: v };
    });
  }

  function removeEditingVariant(idx) {
    setEditingProduct((p) => ({ ...p, variants: (p.variants || []).filter((_, i) => i !== idx) }));
  }

  const cellInputStyle = {
    width: '100%', padding: '6px 8px', borderRadius: 6,
    border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
    color: 'var(--noorix-text)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div className="flex flex-col gap-4">
            <AddSizeModal visible={addSizeModal} onClose={() => setAddSizeModal(false)} value={newSize} onChange={setNewSize} onAdd={handleAddSize} />
      <AddPackagingModal visible={addPackagingModal} onClose={() => setAddPackagingModal(false)} value={newPackaging} onChange={setNewPackaging} onAdd={handleAddPackaging} />

      <div className="flex gap-2 border-b border-noorix-border">
        <Button
          type="button"
          onClick={() => setActiveSubTab('products')}
          style={{
            borderBottom: activeSubTab === 'products' ? '2px solid var(--noorix-accent-green)' : '2px solid transparent',
            background: activeSubTab === 'products' ? 'var(--noorix-green-7)' : 'transparent',
            fontWeight: activeSubTab === 'products' ? 700 : 500,
            padding: '8px 16px',
            borderRadius: 0,
          }}
        >
          {t('ordersProducts')}
        </Button>
        <Button
          type="button"
          onClick={() => setActiveSubTab('categories')}
          style={{
            borderBottom: activeSubTab === 'categories' ? '2px solid var(--noorix-accent-green)' : '2px solid transparent',
            background: activeSubTab === 'categories' ? 'var(--noorix-green-7)' : 'transparent',
            fontWeight: activeSubTab === 'categories' ? 700 : 500,
            padding: '8px 16px',
            borderRadius: 0,
          }}
        >
          {t('ordersCategories')}
        </Button>
      </div>

      {activeSubTab === 'products' && (
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
                  <Button size="sm" onClick={() => fileInputProducts.current?.click()} disabled={createProductsBatch.isPending}>{t('import')}</Button>
                  <Button size="sm" onClick={handleExportProducts} disabled={products.length === 0}>{t('exportExcel')}</Button>
                </div>
              </div>
              <p className="m-0 text-[11px] text-noorix-muted leading-[1.45]">
                {t('ordersPresetCatalogHint')}
              </p>
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
                  <option value="">�</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nameAr || c.nameEn || c.id}</option>
                  ))}
                </Input>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] text-noorix-muted">{t('ordersProductVariants')}</label>
                  <Button size="sm" onClick={addVariantToProduct}>+ {t('ordersAddVariant')}</Button>
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
                                <option value="">�</option>
                                {sizesOptions.map((s) => (
                                  <option key={s.ar} value={s.ar}>{s.ar}</option>
                                ))}
                              </Input>
                              <Button size="sm" onClick={() => setAddSizeModal(true)} title={t('add')}>+</Button>
                            </div>
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="flex gap-1">
                              <Input type="select" value={v.packaging} onChange={(e) => updateNewProductVariant(idx, 'packaging', e.target.value)} className="flex-1 min-w-0">
                                <option value="">�</option>
                                {packagingOptions.map((s) => (
                                  <option key={s.ar} value={s.ar}>{s.ar}</option>
                                ))}
                              </Input>
                              <Button size="sm" onClick={() => setAddPackagingModal(true)} title={t('add')}>+</Button>
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
                            <Button size="sm" variant="danger" onClick={() => removeNewProductVariant(idx)}>?</Button>
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
                  const variantsSummary = variants.length > 0
                    ? variants.map((v) => `${v.size || '�'}/${v.packaging || '�'}/${v.unit || 'piece'}: ${fmt(v.lastPrice ?? 0)}`).join(' | ')
                    : (p.lastPrice ? fmt(p.lastPrice) + ' (�������)' : '�');
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
                                  <option value="">�</option>
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.nameAr || c.nameEn}</option>
                                  ))}
                                </Input>
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[11px] text-noorix-muted">{t('ordersProductVariants')}</label>
                                <Button size="sm" onClick={() => setEditingProduct((x) => ({ ...x, variants: [...(x.variants || []), { size: '', packaging: '', unit: 'piece', lastPrice: '' }] }))}>+ {t('ordersAddVariant')}</Button>
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
                                            <option value="">�</option>
                                            {sizesOptions.map((s) => (
                                              <option key={s.ar} value={s.ar}>{s.ar}</option>
                                            ))}
                                          </Input>
                                        </td>
                                        <td className="py-1 px-1.5">
                                          <Input type="select" value={v.packaging} onChange={(e) => updateEditingVariant(idx, 'packaging', e.target.value)}>
                                            <option value="">�</option>
                                            {packagingOptions.map((s) => (
                                              <option key={s.ar} value={s.ar}>{s.ar}</option>
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
                                          <Button size="sm" variant="danger" onClick={() => removeEditingVariant(idx)}>?</Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div className="nx-toolbar">
                              <Button size="sm" variant="primary" onClick={handleUpdateProduct}>{t('save')}</Button>
                              <Button size="sm" onClick={() => setEditingProduct(null)}>{t('cancel')}</Button>
                            </div>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-[10px] px-3">{p.nameAr || '�'}</td>
                        <td className="nx-cell-muted py-[10px] px-3">{p.nameEn || '�'}</td>
                        <td className="nx-cell-muted py-[10px] px-3">{p.category?.nameAr || p.category?.nameEn || '�'}</td>
                        <td className="nx-cell-ellipsis nx-cell-muted py-[10px] px-3 text-[12px] max-w-[280px]" title={variantsSummary}>{variantsSummary}</td>
                        <td className="text-center py-[10px] px-3">
                          <Button size="sm" onClick={() => setEditingProduct({ id: p.id, nameAr: p.nameAr, nameEn: p.nameEn || '', categoryId: p.categoryId || '', variants: variants.length > 0 ? variants.map((v) => ({ size: v.size || '', packaging: v.packaging || '', unit: v.unit || 'piece', lastPrice: v.lastPrice ? String(v.lastPrice) : '' })) : [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }] })}>{t('edit')}</Button>
                        </td>
                      </>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {products.length === 0 && (
              <div className="text-center text-noorix-muted p-[30px]">{t('ordersNoProductsYet')}</div>
            )}
            {products.length > 0 && filteredProducts.length === 0 && (
              <div className="text-center text-noorix-muted p-[30px]">{t('ordersNoSearchResults')}</div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'categories' && (
        <div className="grid gap-5">
          <div className="noorix-surface-card p-4 lg:p-5">
            <div className="flex flex-col gap-3 mb-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="m-0 text-[15px]">+ {t('ordersAddCategory')}</h4>
                <OrdersImportHelpTrigger t={t} variant="categories" />
              </div>
              <input ref={fileInputCategories} type="file" accept=".xlsx,.xls" onChange={handleImportCategories} className="hidden" />
              <div className="overflow-x-auto">
                <div className="flex gap-2 w-max">
                  <Button size="sm" onClick={handleDownloadCategoriesImportTemplate}>
                    {t('ordersDownloadImportTemplate')}
                  </Button>
                  <Button size="sm" onClick={() => fileInputCategories.current?.click()} disabled={createCategoriesBatch.isPending}>{t('import')}</Button>
                  <Button size="sm" onClick={handleExportCategories} disabled={categories.length === 0}>{t('exportExcel')}</Button>
                </div>
              </div>
            </div>
              <div className="flex gap-3 flex flex-wrap items-end">
              <div className="min-w-[180px]">
                <Input
                  label={`${t('categoryNameAr')} *`}
                  value={newCategory.nameAr}
                  onChange={(e) => setNewCategory((p) => ({ ...p, nameAr: e.target.value }))}
                  placeholder={t('categoryNameAr')}
                />
              </div>
              <div className="min-w-[180px]">
                <Input
                  label={t('categoryNameEn')}
                  value={newCategory.nameEn}
                  onChange={(e) => setNewCategory((p) => ({ ...p, nameEn: e.target.value }))}
                  placeholder={t('categoryNameEn')}
                />
              </div>
              <Button size="sm" variant="primary" onClick={handleCreateCategory} disabled={createCategory.isPending || !companyId}>
                {createCategory.isPending ? t('saving') : t('add')}
              </Button>
            </div>
          </div>

          <div className="noorix-surface-card overflow-auto">
            <div className="nx-section-header justify-end">
              <Input
                type="search"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                placeholder={t('ordersSearchCategories')}
                aria-label={t('ordersSearchCategories')}
                className="max-w-[320px]"
              />
            </div>
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="border-b-2 border-noorix-border">
                  <th className="font-bold text-right py-[10px] px-3">{t('categoryNameAr')}</th>
                  <th className="font-bold text-right py-[10px] px-3">{t('categoryNameEn')}</th>
                  <th className="text-center font-bold py-[10px] px-3">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((c) => (
                  <tr key={c.id} className="border-b border-noorix-border">
                    {editingCategory?.id === c.id ? (
                      <>
                        <td className="py-2 px-3">
                          <Input type="text" value={editingCategory.nameAr} onChange={(e) => setEditingCategory((x) => ({ ...x, nameAr: e.target.value }))} placeholder={t('categoryNameAr')} />
                        </td>
                        <td className="py-2 px-3">
                          <Input type="text" value={editingCategory.nameEn || ''} onChange={(e) => setEditingCategory((x) => ({ ...x, nameEn: e.target.value }))} placeholder={t('categoryNameEn')} />
                        </td>
                        <td className="text-center py-2 px-3">
                          <div className="nx-toolbar justify-center">
                            <Button size="sm" onClick={handleUpdateCategory}>{t('save')}</Button>
                            <Button size="sm" onClick={() => setEditingCategory(null)}>{t('cancel')}</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-[10px] px-3">{c.nameAr || '�'}</td>
                        <td className="nx-cell-muted py-[10px] px-3">{c.nameEn || '�'}</td>
                        <td className="text-center py-[10px] px-3">
                          <Button size="sm" onClick={() => setEditingCategory({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn || '' })}>{t('edit')}</Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {categories.length === 0 && (
              <div className="text-center text-noorix-muted p-[30px]">{t('ordersNoCategoriesYet')}</div>
            )}
            {categories.length > 0 && filteredCategories.length === 0 && (
              <div className="text-center text-noorix-muted p-[30px]">{t('ordersNoSearchResults')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
