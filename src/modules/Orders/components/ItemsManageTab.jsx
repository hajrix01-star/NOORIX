/**
 * ItemsManageTab — تبويبة إدارة الأصناف والفئات
 * إعادة بناء مع قوائم منسدلة للأحجام والتغليف + خيار إضافة جديد
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
import Toast from '../../../components/Toast';
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

export function ItemsManageTab({ companyId }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('products');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
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
      setToast({ visible: true, message: t('ordersProductNameRequired'), type: 'error' });
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
        setToast({ visible: true, message: t('ordersProductAdded'), type: 'success' });
        setNewProduct({ nameAr: '', nameEn: '', categoryId: '', variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }] });
      },
      onError: (e) => {
        setToast({ visible: true, message: e?.message || e?.error || t('addFailed'), type: 'error' });
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
          setToast({ visible: true, message: t('ordersProductUpdated'), type: 'success' });
          setEditingProduct(null);
        },
        onError: (e) => {
          setToast({ visible: true, message: e?.message || e?.error || t('updateFailed'), type: 'error' });
        },
      },
    );
  }

  function handleCreateCategory() {
    if (!newCategory.nameAr?.trim()) {
      setToast({ visible: true, message: t('ordersCategoryNameRequired'), type: 'error' });
      return;
    }
    createCategory.mutate(
      { companyId, nameAr: newCategory.nameAr.trim(), nameEn: newCategory.nameEn?.trim() || undefined },
      {
        onSuccess: () => {
          setToast({ visible: true, message: t('ordersCategoryAdded'), type: 'success' });
          setNewCategory({ nameAr: '', nameEn: '' });
        },
        onError: (e) => setToast({ visible: true, message: e?.message || t('addFailed'), type: 'error' }),
      },
    );
  }

  function handleAddSize() {
    const ar = (newSize.ar || '').trim();
    if (!ar) {
      setToast({ visible: true, message: t('ordersSizeNameRequired') || 'اسم الحجم بالعربية مطلوب', type: 'error' });
      return;
    }
    addCustomSize(companyId, ar, newSize.en);
    setSizesKey((k) => k + 1);
    setNewSize({ ar: '', en: '' });
    setAddSizeModal(false);
    setToast({ visible: true, message: t('ordersSizeAdded') || 'تمت إضافة الحجم', type: 'success' });
  }

  function handleAddPackaging() {
    const ar = (newPackaging.ar || '').trim();
    if (!ar) {
      setToast({ visible: true, message: t('ordersPackagingNameRequired') || 'اسم التغليف بالعربية مطلوب', type: 'error' });
      return;
    }
    addCustomPackaging(companyId, ar, newPackaging.en);
    setPackagingKey((k) => k + 1);
    setNewPackaging({ ar: '', en: '' });
    setAddPackagingModal(false);
    setToast({ visible: true, message: t('ordersPackagingAdded') || 'تمت إضافة التغليف', type: 'success' });
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
        if (!batchRes?.success) throw new Error(batchRes?.error || t('addFailed'));
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
          if (!r?.success) throw new Error(r?.error || t('updateFailed'));
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
        if (!batchRes?.success) throw new Error(batchRes?.error || t('addFailed'));
        added = productsPayload.length;
      }

      queryClient.invalidateQueries({ queryKey: ['order-products', companyId] });
      queryClient.invalidateQueries({ queryKey: ['order-categories', companyId] });

      if (added === 0 && updated === 0 && catsAdded === 0) {
        setToast({ visible: true, message: t('ordersPresetNothingDone'), type: 'success' });
      } else {
        setToast({
          visible: true,
          message: t('ordersPresetDone', String(added), String(updated), String(catsAdded)),
          type: 'success',
        });
      }
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('addFailed'), type: 'error' });
    } finally {
      setPresetBusy(false);
    }
  }

  async function handleDownloadProductsImportTemplate() {
    try {
      await exportOrdersProductsImportTemplate('order-products-import-template.xlsx');
      setToast({ visible: true, message: t('ordersImportTemplateReady'), type: 'success' });
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('exportFailed'), type: 'error' });
    }
  }

  async function handleDownloadCategoriesImportTemplate() {
    try {
      await exportOrdersCategoriesImportTemplate('order-categories-import-template.xlsx');
      setToast({ visible: true, message: t('ordersImportTemplateReady'), type: 'success' });
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('exportFailed'), type: 'error' });
    }
  }

  async function handleExportProducts() {
    try {
      await exportOrderProductsWorkbook(products, 'order-products.xlsx');
      setToast({ visible: true, message: t('exportSuccess'), type: 'success' });
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('exportFailed'), type: 'error' });
    }
  }

  async function handleExportCategories() {
    try {
      await exportOrderCategoriesWorkbook(categories, 'order-categories.xlsx');
      setToast({ visible: true, message: t('exportSuccess'), type: 'success' });
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('exportFailed'), type: 'error' });
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
        setToast({ visible: true, message: t('ordersImportNoValidRows'), type: 'error' });
        return;
      }
      createProductsBatch.mutate(toCreate, {
        onSuccess: (data) => {
          setToast({ visible: true, message: t('ordersImportSuccess', data?.length ?? toCreate.length), type: 'success' });
          if (fileInputProducts.current) fileInputProducts.current.value = '';
        },
        onError: (err) => setToast({ visible: true, message: err?.message || err?.error || t('importFailed'), type: 'error' }),
      });
    } catch (err) {
      setToast({ visible: true, message: err?.message || t('importFailed'), type: 'error' });
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
        setToast({ visible: true, message: t('ordersImportNoValidRows'), type: 'error' });
        return;
      }
      createCategoriesBatch.mutate(toCreate, {
        onSuccess: (data) => {
          setToast({ visible: true, message: t('ordersImportSuccess', data?.length ?? toCreate.length), type: 'success' });
          if (fileInputCategories.current) fileInputCategories.current.value = '';
        },
        onError: (err) => setToast({ visible: true, message: err?.message || t('importFailed'), type: 'error' }),
      });
    } catch (err) {
      setToast({ visible: true, message: err?.message || t('importFailed'), type: 'error' });
    }
  }

  function handleUpdateCategory() {
    if (!editingCategory?.id) return;
    updateCategory.mutate(
      { id: editingCategory.id, body: { nameAr: editingCategory.nameAr, nameEn: editingCategory.nameEn ?? null } },
      {
        onSuccess: () => {
          setToast({ visible: true, message: t('ordersCategoryUpdated'), type: 'success' });
          setEditingCategory(null);
        },
        onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }),
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
    <div className="nx-screen">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <AddSizeModal visible={addSizeModal} onClose={() => setAddSizeModal(false)} value={newSize} onChange={setNewSize} onAdd={handleAddSize} />
      <AddPackagingModal visible={addPackagingModal} onClose={() => setAddPackagingModal(false)} value={newPackaging} onChange={setNewPackaging} onAdd={handleAddPackaging} />

      <div className="nx-flex nx-gap-8 nx-border-b">
        <Button
          type="button"
          onClick={() => setActiveSubTab('products')}
          style={{
            borderBottom: activeSubTab === 'products' ? '2px solid var(--noorix-accent-green)' : '2px solid transparent',
            background: activeSubTab === 'products' ? 'rgba(22,163,74,0.07)' : 'transparent',
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
            background: activeSubTab === 'categories' ? 'rgba(22,163,74,0.07)' : 'transparent',
            fontWeight: activeSubTab === 'categories' ? 700 : 500,
            padding: '8px 16px',
            borderRadius: 0,
          }}
        >
          {t('ordersCategories')}
        </Button>
      </div>

      {activeSubTab === 'products' && (
        <div className="nx-grid nx-gap-20">
          <div className="noorix-surface-card nx-p-20">
            <div className="nx-flex nx-gap-12 nx-mb-12 nx-flex-wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h4 className="nx-m-0 nx-text-lg">+ {t('ordersAddProduct')}</h4>
              <div className="nx-flex-col nx-gap-8" style={{ alignItems: 'flex-end' }}>
                <div className="nx-toolbar" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <OrdersImportHelpTrigger t={t} variant="products" />
                  <input ref={fileInputProducts} type="file" accept=".xlsx,.xls" onChange={handleImportProducts} style={{ display: 'none' }} />
                  <Button variant="primary" onClick={handleInsertPresetCatalog} disabled={presetBusy || !companyId}>
                    {presetBusy ? t('saving') : t('ordersPresetCatalogButton')}
                  </Button>
                  <Button onClick={handleDownloadProductsImportTemplate}>
                    {t('ordersDownloadImportTemplate')}
                  </Button>
                  <Button onClick={() => fileInputProducts.current?.click()} disabled={createProductsBatch.isPending}>{t('import')}</Button>
                  <Button onClick={handleExportProducts} disabled={products.length === 0}>{t('exportExcel')}</Button>
                </div>
                <p className="nx-m-0 nx-text-xs nx-text-muted nx-text-end" style={{ maxWidth: 560, lineHeight: 1.45 }}>
                  {t('ordersPresetCatalogHint')}
                </p>
              </div>
            </div>
            <div className="nx-grid nx-gap-16">
              <div className="nx-grid nx-gap-12" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
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
                    <option key={c.id} value={c.id}>{c.nameAr || c.nameEn || c.id}</option>
                  ))}
                </Input>
              </div>
              <div>
                <div className="nx-flex-between nx-mb-8">
                  <label className="nx-text-sm nx-text-muted">{t('ordersProductVariants')}</label>
                  <Button size="sm" onClick={addVariantToProduct}>+ {t('ordersAddVariant')}</Button>
                </div>
                <div className="nx-rounded nx-border-all nx-overflow-auto">
                  <table className="nx-w-full nx-text-sm" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="nx-bg-muted nx-border-b">
                        <th className="nx-font-600" style={{ textAlign: 'right', padding: '8px 10px' }}>{t('ordersProductSize')}</th>
                        <th className="nx-font-600" style={{ textAlign: 'right', padding: '8px 10px' }}>{t('ordersProductPackaging')}</th>
                        <th className="nx-font-600" style={{ textAlign: 'right', padding: '8px 10px' }}>{t('unit')}</th>
                        <th className="nx-font-600" style={{ textAlign: 'right', padding: '8px 10px' }}>{t('ordersVariantPrice')}</th>
                        <th style={{ width: 40, padding: '8px 4px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {(newProduct.variants || []).map((v, idx) => (
                        <tr key={idx} className="nx-border-b">
                          <td style={{ padding: '6px 8px' }}>
                            <div className="nx-flex nx-gap-4">
                              <Input type="select" value={v.size} onChange={(e) => updateNewProductVariant(idx, 'size', e.target.value)} className="nx-flex-1">
                                <option value="">—</option>
                                {sizesOptions.map((s) => (
                                  <option key={s.ar} value={s.ar}>{s.ar}</option>
                                ))}
                              </Input>
                              <Button size="sm" onClick={() => setAddSizeModal(true)} title={t('add')}>+</Button>
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <div className="nx-flex nx-gap-4">
                              <Input type="select" value={v.packaging} onChange={(e) => updateNewProductVariant(idx, 'packaging', e.target.value)} className="nx-flex-1">
                                <option value="">—</option>
                                {packagingOptions.map((s) => (
                                  <option key={s.ar} value={s.ar}>{s.ar}</option>
                                ))}
                              </Input>
                              <Button size="sm" onClick={() => setAddPackagingModal(true)} title={t('add')}>+</Button>
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <Input type="select" value={v.unit} onChange={(e) => updateNewProductVariant(idx, 'unit', e.target.value)}>
                              <option value="piece">{t('ordersUnitPiece')}</option>
                              <option value="kg">{t('ordersUnitKg')}</option>
                              <option value="box">{t('ordersUnitBox')}</option>
                              <option value="dozen">{t('ordersUnitDozen')}</option>
                            </Input>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <Input type="number" min="0" step="0.01" value={v.lastPrice} onChange={(e) => updateNewProductVariant(idx, 'lastPrice', e.target.value)} placeholder="0" style={{ width: 80 }} />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <Button size="sm" variant="danger" onClick={() => removeNewProductVariant(idx)}>✕</Button>
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

          <div className="noorix-surface-card nx-overflow-auto">
            <div className="nx-section-header" style={{ justifyContent: 'flex-end' }}>
              <Input
                type="search"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder={t('ordersSearchProducts')}
                aria-label={t('ordersSearchProducts')}
                style={{ maxWidth: 320 }}
              />
            </div>
            <table className="nx-w-full nx-text-base" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--noorix-border)' }}>
                  <th className="nx-font-700" style={{ textAlign: 'right', padding: '10px 12px' }}>{t('productNameAr')}</th>
                  <th className="nx-font-700" style={{ textAlign: 'right', padding: '10px 12px' }}>{t('productNameEn')}</th>
                  <th className="nx-font-700" style={{ textAlign: 'right', padding: '10px 12px' }}>{t('category')}</th>
                  <th className="nx-font-700" style={{ textAlign: 'right', padding: '10px 12px' }}>{t('ordersProductVariants')}</th>
                  <th className="nx-text-center nx-font-700" style={{ padding: '10px 12px' }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const variants = Array.isArray(p.variants) ? p.variants : [];
                  const variantsSummary = variants.length > 0
                    ? variants.map((v) => `${v.size || '—'}/${v.packaging || '—'}/${v.unit || 'piece'}: ${fmt(v.lastPrice ?? 0, 2)}`).join(' | ')
                    : (p.lastPrice ? fmt(p.lastPrice, 2) + ' (افتراضي)' : '—');
                  return (
                  <tr key={p.id} className="nx-border-b">
                    {editingProduct?.id === p.id ? (
                      <>
                        <td style={{ padding: '8px 12px' }} colSpan={5}>
                          <div className="nx-grid nx-gap-12">
                            <div className="nx-flex-wrap nx-gap-12">
                              <div style={{ minWidth: 140 }}>
                                <label className="nx-text-xs nx-text-muted">{t('productNameAr')}</label>
                                <Input type="text" value={editingProduct.nameAr} onChange={(e) => setEditingProduct((x) => ({ ...x, nameAr: e.target.value }))} />
                              </div>
                              <div style={{ minWidth: 140 }}>
                                <label className="nx-text-xs nx-text-muted">{t('productNameEn')}</label>
                                <Input type="text" value={editingProduct.nameEn || ''} onChange={(e) => setEditingProduct((x) => ({ ...x, nameEn: e.target.value }))} />
                              </div>
                              <div style={{ minWidth: 120 }}>
                                <label className="nx-text-xs nx-text-muted">{t('category')}</label>
                                <Input type="select" value={editingProduct.categoryId || ''} onChange={(e) => setEditingProduct((x) => ({ ...x, categoryId: e.target.value }))}>
                                  <option value="">—</option>
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.nameAr || c.nameEn}</option>
                                  ))}
                                </Input>
                              </div>
                            </div>
                            <div>
                              <div className="nx-flex-between nx-mb-6">
                                <label className="nx-text-xs nx-text-muted">{t('ordersProductVariants')}</label>
                                <Button size="sm" onClick={() => setEditingProduct((x) => ({ ...x, variants: [...(x.variants || []), { size: '', packaging: '', unit: 'piece', lastPrice: '' }] }))}>+ {t('ordersAddVariant')}</Button>
                              </div>
                              <div className="nx-border-all nx-overflow-auto" style={{ borderRadius: 6 }}>
                                <table className="nx-w-full nx-text-xs" style={{ borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr className="nx-bg-muted">
                                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>{t('ordersProductSize')}</th>
                                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>{t('ordersProductPackaging')}</th>
                                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>{t('unit')}</th>
                                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>{t('ordersVariantPrice')}</th>
                                      <th style={{ width: 36 }} />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(editingProduct.variants || []).map((v, idx) => (
                                      <tr key={idx}>
                                        <td style={{ padding: '4px 6px' }}>
                                          <Input type="select" value={v.size} onChange={(e) => updateEditingVariant(idx, 'size', e.target.value)}>
                                            <option value="">—</option>
                                            {sizesOptions.map((s) => (
                                              <option key={s.ar} value={s.ar}>{s.ar}</option>
                                            ))}
                                          </Input>
                                        </td>
                                        <td style={{ padding: '4px 6px' }}>
                                          <Input type="select" value={v.packaging} onChange={(e) => updateEditingVariant(idx, 'packaging', e.target.value)}>
                                            <option value="">—</option>
                                            {packagingOptions.map((s) => (
                                              <option key={s.ar} value={s.ar}>{s.ar}</option>
                                            ))}
                                          </Input>
                                        </td>
                                        <td style={{ padding: '4px 6px' }}>
                                          <Input type="select" value={v.unit} onChange={(e) => updateEditingVariant(idx, 'unit', e.target.value)}>
                                            <option value="piece">{t('ordersUnitPiece')}</option>
                                            <option value="kg">{t('ordersUnitKg')}</option>
                                            <option value="box">{t('ordersUnitBox')}</option>
                                            <option value="dozen">{t('ordersUnitDozen')}</option>
                                          </Input>
                                        </td>
                                        <td style={{ padding: '4px 6px' }}>
                                          <Input type="number" min="0" step="0.01" value={v.lastPrice} onChange={(e) => updateEditingVariant(idx, 'lastPrice', e.target.value)} style={{ width: 70 }} />
                                        </td>
                                        <td style={{ padding: '4px' }}>
                                          <Button size="sm" variant="danger" onClick={() => removeEditingVariant(idx)}>✕</Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div className="nx-toolbar">
                              <Button variant="primary" onClick={handleUpdateProduct}>{t('save')}</Button>
                              <Button onClick={() => setEditingProduct(null)}>{t('cancel')}</Button>
                            </div>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '10px 12px' }}>{p.nameAr || '—'}</td>
                        <td className="nx-cell-muted" style={{ padding: '10px 12px' }}>{p.nameEn || '—'}</td>
                        <td className="nx-cell-muted" style={{ padding: '10px 12px' }}>{p.category?.nameAr || p.category?.nameEn || '—'}</td>
                        <td className="nx-cell-ellipsis nx-cell-muted" style={{ padding: '10px 12px', fontSize: 12, maxWidth: 280 }} title={variantsSummary}>{variantsSummary}</td>
                        <td className="nx-text-center" style={{ padding: '10px 12px' }}>
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
              <div className="nx-text-center nx-text-muted" style={{ padding: 30 }}>{t('ordersNoProductsYet')}</div>
            )}
            {products.length > 0 && filteredProducts.length === 0 && (
              <div className="nx-text-center nx-text-muted" style={{ padding: 30 }}>{t('ordersNoSearchResults')}</div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'categories' && (
        <div className="nx-grid nx-gap-20">
          <div className="noorix-surface-card nx-p-20">
            <div className="nx-flex nx-gap-12 nx-mb-12 nx-flex-wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h4 className="nx-m-0 nx-text-lg">+ {t('ordersAddCategory')}</h4>
              <div className="nx-flex-col nx-gap-8" style={{ alignItems: 'flex-end' }}>
                <div className="nx-toolbar" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <OrdersImportHelpTrigger t={t} variant="categories" />
                  <input ref={fileInputCategories} type="file" accept=".xlsx,.xls" onChange={handleImportCategories} style={{ display: 'none' }} />
                  <Button onClick={handleDownloadCategoriesImportTemplate}>
                    {t('ordersDownloadImportTemplate')}
                  </Button>
                  <Button onClick={() => fileInputCategories.current?.click()} disabled={createCategoriesBatch.isPending}>{t('import')}</Button>
                  <Button onClick={handleExportCategories} disabled={categories.length === 0}>{t('exportExcel')}</Button>
                </div>
              </div>
            </div>
              <div className="nx-flex nx-gap-12 nx-flex-wrap" style={{ alignItems: 'flex-end' }}>
              <div style={{ minWidth: 180 }}>
                <Input
                  label={`${t('categoryNameAr')} *`}
                  value={newCategory.nameAr}
                  onChange={(e) => setNewCategory((p) => ({ ...p, nameAr: e.target.value }))}
                  placeholder={t('categoryNameAr')}
                />
              </div>
              <div style={{ minWidth: 180 }}>
                <Input
                  label={t('categoryNameEn')}
                  value={newCategory.nameEn}
                  onChange={(e) => setNewCategory((p) => ({ ...p, nameEn: e.target.value }))}
                  placeholder={t('categoryNameEn')}
                />
              </div>
              <Button variant="primary" onClick={handleCreateCategory} disabled={createCategory.isPending || !companyId}>
                {createCategory.isPending ? t('saving') : t('add')}
              </Button>
            </div>
          </div>

          <div className="noorix-surface-card nx-overflow-auto">
            <div className="nx-section-header" style={{ justifyContent: 'flex-end' }}>
              <Input
                type="search"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                placeholder={t('ordersSearchCategories')}
                aria-label={t('ordersSearchCategories')}
                style={{ maxWidth: 320 }}
              />
            </div>
            <table className="nx-w-full nx-text-base" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--noorix-border)' }}>
                  <th className="nx-font-700" style={{ textAlign: 'right', padding: '10px 12px' }}>{t('categoryNameAr')}</th>
                  <th className="nx-font-700" style={{ textAlign: 'right', padding: '10px 12px' }}>{t('categoryNameEn')}</th>
                  <th className="nx-text-center nx-font-700" style={{ padding: '10px 12px' }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((c) => (
                  <tr key={c.id} className="nx-border-b">
                    {editingCategory?.id === c.id ? (
                      <>
                        <td style={{ padding: '8px 12px' }}>
                          <Input type="text" value={editingCategory.nameAr} onChange={(e) => setEditingCategory((x) => ({ ...x, nameAr: e.target.value }))} placeholder={t('categoryNameAr')} />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <Input type="text" value={editingCategory.nameEn || ''} onChange={(e) => setEditingCategory((x) => ({ ...x, nameEn: e.target.value }))} placeholder={t('categoryNameEn')} />
                        </td>
                        <td className="nx-text-center" style={{ padding: '8px 12px' }}>
                          <div className="nx-toolbar" style={{ justifyContent: 'center' }}>
                            <Button size="sm" onClick={handleUpdateCategory}>{t('save')}</Button>
                            <Button size="sm" onClick={() => setEditingCategory(null)}>{t('cancel')}</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '10px 12px' }}>{c.nameAr || '—'}</td>
                        <td className="nx-cell-muted" style={{ padding: '10px 12px' }}>{c.nameEn || '—'}</td>
                        <td className="nx-text-center" style={{ padding: '10px 12px' }}>
                          <Button size="sm" onClick={() => setEditingCategory({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn || '' })}>{t('edit')}</Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {categories.length === 0 && (
              <div className="nx-text-center nx-text-muted" style={{ padding: 30 }}>{t('ordersNoCategoriesYet')}</div>
            )}
            {categories.length > 0 && filteredCategories.length === 0 && (
              <div className="nx-text-center nx-text-muted" style={{ padding: 30 }}>{t('ordersNoSearchResults')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
