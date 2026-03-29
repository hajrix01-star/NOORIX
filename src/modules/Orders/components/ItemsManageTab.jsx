/**
 * ItemsManageTab — تبويبة إدارة الأصناف والفئات
 * إعادة بناء مع قوائم منسدلة للأحجام والتغليف + خيار إضافة جديد
 */
import React, { useState, useRef, useMemo } from 'react';
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
  exportToExcel,
  importFromExcel,
  exportOrdersProductsImportTemplate,
  exportOrdersCategoriesImportTemplate,
} from '../../../utils/exportUtils';
import Toast from '../../../components/Toast';
import {
  getSizesOptions,
  getPackagingOptions,
  addCustomSize,
  addCustomPackaging,
} from '../constants/orderDefaults';
import {
  ORDER_PRODUCTS_TEMPLATE_MARKER_AR,
  ORDER_CATEGORIES_TEMPLATE_MARKER_AR,
} from '../constants/importTemplate';
import { AddSizeModal } from './AddSizeModal';
import { AddPackagingModal } from './AddPackagingModal';

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
};

export function ItemsManageTab({ companyId }) {
  const { t } = useTranslation();
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

  const importGuideCardStyle = useMemo(
    () => ({
      padding: '14px 18px',
      borderRadius: 12,
      border: '1px solid var(--noorix-border)',
      borderInlineStart: '4px solid var(--noorix-accent-green)',
      background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.07) 0%, transparent 58%)',
    }),
    [],
  );

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
      const rows = products.map((p) => {
        const variants = Array.isArray(p.variants) ? p.variants : [];
        return {
          nameAr: p.nameAr,
          nameEn: p.nameEn || '',
          category: p.category?.nameAr || p.category?.nameEn || '',
          variants: variants.length > 0 ? JSON.stringify(variants.map((v) => ({ size: v.size, packaging: v.packaging, unit: v.unit, lastPrice: String(v.lastPrice ?? 0) }))) : '',
        };
      });
      await exportToExcel(rows, 'order-products.xlsx');
      setToast({ visible: true, message: t('exportSuccess'), type: 'success' });
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('exportFailed'), type: 'error' });
    }
  }

  async function handleExportCategories() {
    try {
      const rows = categories.map((c) => ({ nameAr: c.nameAr, nameEn: c.nameEn || '' }));
      await exportToExcel(rows, 'order-categories.xlsx');
      setToast({ visible: true, message: t('exportSuccess'), type: 'success' });
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('exportFailed'), type: 'error' });
    }
  }

  async function handleImportProducts(e) {
    const file = e?.target?.files?.[0];
    if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const catByName = new Map(categories.map((c) => [c.nameAr?.toLowerCase(), c.id]));
      const toCreate = rows
        .filter((r) => r.nameAr || r.name_ar)
        .filter((r) => String(r.nameAr ?? r.name_ar ?? '').trim() !== ORDER_PRODUCTS_TEMPLATE_MARKER_AR)
        .map((r) => {
          const catName = String(r.category ?? r.categoryName ?? '').trim().toLowerCase();
          const categoryId = catName ? catByName.get(catName) : undefined;
          let variants;
          try {
            variants = r.variants ? JSON.parse(r.variants) : undefined;
            if (Array.isArray(variants)) {
              variants = variants.map((v) => ({ size: v.size || '', packaging: v.packaging || '', unit: v.unit || 'piece', lastPrice: String(v.lastPrice ?? 0) }));
            }
          } catch {
            variants = undefined;
          }
          return {
            nameAr: String(r.nameAr ?? r.name_ar ?? '').trim(),
            nameEn: String(r.nameEn ?? r.name_en ?? '').trim() || undefined,
            categoryId: categoryId || undefined,
            variants,
          };
        })
        .filter((r) => r.nameAr);
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
      const toCreate = rows
        .filter((r) => r.nameAr || r.name_ar)
        .filter((r) => String(r.nameAr ?? r.name_ar ?? '').trim() !== ORDER_CATEGORIES_TEMPLATE_MARKER_AR)
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

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <AddSizeModal visible={addSizeModal} onClose={() => setAddSizeModal(false)} value={newSize} onChange={setNewSize} onAdd={handleAddSize} />
      <AddPackagingModal visible={addPackagingModal} onClose={() => setAddPackagingModal(false)} value={newPackaging} onChange={setNewPackaging} onAdd={handleAddPackaging} />

      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--noorix-border)' }}>
        <button
          type="button"
          className="noorix-btn-nav"
          onClick={() => setActiveSubTab('products')}
          style={{
            borderBottom: activeSubTab === 'products' ? '2px solid var(--noorix-accent-green)' : '2px solid transparent',
            background: activeSubTab === 'products' ? 'rgba(22,163,74,0.07)' : 'transparent',
            fontWeight: activeSubTab === 'products' ? 700 : 500,
            padding: '8px 16px',
          }}
        >
          {t('ordersProducts')}
        </button>
        <button
          type="button"
          className="noorix-btn-nav"
          onClick={() => setActiveSubTab('categories')}
          style={{
            borderBottom: activeSubTab === 'categories' ? '2px solid var(--noorix-accent-green)' : '2px solid transparent',
            background: activeSubTab === 'categories' ? 'rgba(22,163,74,0.07)' : 'transparent',
            fontWeight: activeSubTab === 'categories' ? 700 : 500,
            padding: '8px 16px',
          }}
        >
          {t('ordersCategories')}
        </button>
      </div>

      {activeSubTab === 'products' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={importGuideCardStyle}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, color: 'var(--noorix-text)' }}>{t('ordersImportGuideProductsTitle')}</div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--noorix-text-muted)', lineHeight: 1.55 }}>{t('ordersImportWorkbookNote')}</p>
            <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 12, lineHeight: 1.65, color: 'var(--noorix-text)' }}>
              <li style={{ marginBottom: 6 }}>{t('ordersImportProductsStep1')}</li>
              <li style={{ marginBottom: 6 }}>{t('ordersImportProductsStep2')}</li>
              <li>{t('ordersImportProductsStep3')}</li>
            </ul>
          </div>
          <div className="noorix-surface-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 15 }}>+ {t('ordersAddProduct')}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                  <input ref={fileInputProducts} type="file" accept=".xlsx,.xls" onChange={handleImportProducts} style={{ display: 'none' }} />
                  <button type="button" className="noorix-btn-nav" onClick={handleDownloadProductsImportTemplate}>
                    📄 {t('ordersDownloadImportTemplate')}
                  </button>
                  <button type="button" className="noorix-btn-nav" onClick={() => fileInputProducts.current?.click()} disabled={createProductsBatch.isPending}>📥 {t('import')}</button>
                  <button type="button" className="noorix-btn-nav" onClick={handleExportProducts} disabled={products.length === 0}>📤 {t('exportExcel')}</button>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--noorix-text-muted)', maxWidth: 520, textAlign: 'right', lineHeight: 1.45 }}>
                  {t('ordersImportTemplateHintProducts')}
                </p>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('productNameAr')} *</label>
                  <input type="text" value={newProduct.nameAr} onChange={(e) => setNewProduct((p) => ({ ...p, nameAr: e.target.value }))} placeholder={t('productNameAr')} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('productNameEn')}</label>
                  <input type="text" value={newProduct.nameEn} onChange={(e) => setNewProduct((p) => ({ ...p, nameEn: e.target.value }))} placeholder={t('productNameEn')} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('category')}</label>
                  <select value={newProduct.categoryId} onChange={(e) => setNewProduct((p) => ({ ...p, categoryId: e.target.value }))} style={inputStyle}>
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.nameAr || c.nameEn || c.id}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('ordersProductVariants')}</label>
                  <button type="button" className="noorix-btn-nav" onClick={addVariantToProduct} style={{ padding: '6px 12px', fontSize: 12 }}>+ {t('ordersAddVariant')}</button>
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid var(--noorix-border)', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--noorix-bg-muted)', borderBottom: '1px solid var(--noorix-border)' }}>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>{t('ordersProductSize')}</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>{t('ordersProductPackaging')}</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>{t('unit')}</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>{t('ordersVariantPrice')}</th>
                        <th style={{ width: 40, padding: '8px 4px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {(newProduct.variants || []).map((v, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--noorix-border)' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <select value={v.size} onChange={(e) => updateNewProductVariant(idx, 'size', e.target.value)} style={{ ...inputStyle, padding: '6px 8px', flex: 1 }}>
                                <option value="">—</option>
                                {sizesOptions.map((s) => (
                                  <option key={s.ar} value={s.ar}>{s.ar}</option>
                                ))}
                              </select>
                              <button type="button" className="noorix-btn-nav" onClick={() => setAddSizeModal(true)} title={t('add')} style={{ padding: '6px 8px' }}>+</button>
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <select value={v.packaging} onChange={(e) => updateNewProductVariant(idx, 'packaging', e.target.value)} style={{ ...inputStyle, padding: '6px 8px', flex: 1 }}>
                                <option value="">—</option>
                                {packagingOptions.map((s) => (
                                  <option key={s.ar} value={s.ar}>{s.ar}</option>
                                ))}
                              </select>
                              <button type="button" className="noorix-btn-nav" onClick={() => setAddPackagingModal(true)} title={t('add')} style={{ padding: '6px 8px' }}>+</button>
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <select value={v.unit} onChange={(e) => updateNewProductVariant(idx, 'unit', e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }}>
                              <option value="piece">{t('ordersUnitPiece')}</option>
                              <option value="kg">{t('ordersUnitKg')}</option>
                              <option value="box">{t('ordersUnitBox')}</option>
                              <option value="dozen">{t('ordersUnitDozen')}</option>
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input type="number" min="0" step="0.01" value={v.lastPrice} onChange={(e) => updateNewProductVariant(idx, 'lastPrice', e.target.value)} placeholder="0" style={{ ...inputStyle, padding: '6px 8px', width: 80 }} />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <button type="button" className="noorix-btn-nav" onClick={() => removeNewProductVariant(idx)} style={{ padding: '6px 8px', color: '#dc2626' }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={handleCreateProduct} disabled={createProduct.isPending || !companyId}>
                  {createProduct.isPending ? t('saving') : t('add')}
                </button>
              </div>
            </div>
          </div>

          <div className="noorix-surface-card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--noorix-border)' }}>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{t('productNameAr')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{t('productNameEn')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{t('category')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{t('ordersProductVariants')}</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 700 }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const variants = Array.isArray(p.variants) ? p.variants : [];
                  const variantsSummary = variants.length > 0
                    ? variants.map((v) => `${v.size || '—'}/${v.packaging || '—'}/${v.unit || 'piece'}: ${fmt(v.lastPrice ?? 0, 2)}`).join(' | ')
                    : (p.lastPrice ? fmt(p.lastPrice, 2) + ' (افتراضي)' : '—');
                  return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--noorix-border)' }}>
                    {editingProduct?.id === p.id ? (
                      <>
                        <td style={{ padding: '8px 12px' }} colSpan={5}>
                          <div style={{ display: 'grid', gap: 12 }}>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              <div style={{ minWidth: 140 }}>
                                <label style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('productNameAr')}</label>
                                <input type="text" value={editingProduct.nameAr} onChange={(e) => setEditingProduct((x) => ({ ...x, nameAr: e.target.value }))} style={{ ...inputStyle, padding: '6px 10px' }} />
                              </div>
                              <div style={{ minWidth: 140 }}>
                                <label style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('productNameEn')}</label>
                                <input type="text" value={editingProduct.nameEn || ''} onChange={(e) => setEditingProduct((x) => ({ ...x, nameEn: e.target.value }))} style={{ ...inputStyle, padding: '6px 10px' }} />
                              </div>
                              <div style={{ minWidth: 120 }}>
                                <label style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('category')}</label>
                                <select value={editingProduct.categoryId || ''} onChange={(e) => setEditingProduct((x) => ({ ...x, categoryId: e.target.value }))} style={{ ...inputStyle, padding: '6px 10px' }}>
                                  <option value="">—</option>
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.nameAr || c.nameEn}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <label style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('ordersProductVariants')}</label>
                                <button type="button" className="noorix-btn-nav" onClick={() => setEditingProduct((x) => ({ ...x, variants: [...(x.variants || []), { size: '', packaging: '', unit: 'piece', lastPrice: '' }] }))} style={{ padding: '4px 10px', fontSize: 11 }}>+ {t('ordersAddVariant')}</button>
                              </div>
                              <div style={{ overflowX: 'auto', border: '1px solid var(--noorix-border)', borderRadius: 6 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                  <thead>
                                    <tr style={{ background: 'var(--noorix-bg-muted)' }}>
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
                                          <select value={v.size} onChange={(e) => updateEditingVariant(idx, 'size', e.target.value)} style={{ ...inputStyle, padding: '4px 6px', fontSize: 11, width: '100%' }}>
                                            <option value="">—</option>
                                            {sizesOptions.map((s) => (
                                              <option key={s.ar} value={s.ar}>{s.ar}</option>
                                            ))}
                                          </select>
                                        </td>
                                        <td style={{ padding: '4px 6px' }}>
                                          <select value={v.packaging} onChange={(e) => updateEditingVariant(idx, 'packaging', e.target.value)} style={{ ...inputStyle, padding: '4px 6px', fontSize: 11, width: '100%' }}>
                                            <option value="">—</option>
                                            {packagingOptions.map((s) => (
                                              <option key={s.ar} value={s.ar}>{s.ar}</option>
                                            ))}
                                          </select>
                                        </td>
                                        <td style={{ padding: '4px 6px' }}>
                                          <select value={v.unit} onChange={(e) => updateEditingVariant(idx, 'unit', e.target.value)} style={{ ...inputStyle, padding: '4px 6px', fontSize: 11, width: '100%' }}>
                                            <option value="piece">{t('ordersUnitPiece')}</option>
                                            <option value="kg">{t('ordersUnitKg')}</option>
                                            <option value="box">{t('ordersUnitBox')}</option>
                                            <option value="dozen">{t('ordersUnitDozen')}</option>
                                          </select>
                                        </td>
                                        <td style={{ padding: '4px 6px' }}>
                                          <input type="number" min="0" step="0.01" value={v.lastPrice} onChange={(e) => updateEditingVariant(idx, 'lastPrice', e.target.value)} style={{ ...inputStyle, padding: '4px 6px', fontSize: 11, width: 70 }} />
                                        </td>
                                        <td style={{ padding: '4px' }}>
                                          <button type="button" className="noorix-btn-nav" onClick={() => removeEditingVariant(idx)} style={{ padding: '4px 6px', color: '#dc2626', fontSize: 11 }}>✕</button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={handleUpdateProduct}>{t('save')}</button>
                              <button type="button" className="noorix-btn-nav" onClick={() => setEditingProduct(null)}>{t('cancel')}</button>
                            </div>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '10px 12px' }}>{p.nameAr || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--noorix-text-muted)' }}>{p.nameEn || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--noorix-text-muted)' }}>{p.category?.nameAr || p.category?.nameEn || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--noorix-text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }} title={variantsSummary}>{variantsSummary}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button type="button" className="noorix-btn-nav" onClick={() => setEditingProduct({ id: p.id, nameAr: p.nameAr, nameEn: p.nameEn || '', categoryId: p.categoryId || '', variants: variants.length > 0 ? variants.map((v) => ({ size: v.size || '', packaging: v.packaging || '', unit: v.unit || 'piece', lastPrice: v.lastPrice ? String(v.lastPrice) : '' })) : [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }] })} style={{ padding: '6px 10px', fontSize: 12 }}>{t('edit')}</button>
                        </td>
                      </>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {products.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{t('ordersNoProductsYet')}</div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'categories' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={importGuideCardStyle}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, color: 'var(--noorix-text)' }}>{t('ordersImportGuideCategoriesTitle')}</div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--noorix-text-muted)', lineHeight: 1.55 }}>{t('ordersImportWorkbookNote')}</p>
            <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 12, lineHeight: 1.65, color: 'var(--noorix-text)' }}>
              <li style={{ marginBottom: 6 }}>{t('ordersImportCategoriesStep1')}</li>
              <li>{t('ordersImportCategoriesStep2')}</li>
            </ul>
          </div>
          <div className="noorix-surface-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 15 }}>+ {t('ordersAddCategory')}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                  <input ref={fileInputCategories} type="file" accept=".xlsx,.xls" onChange={handleImportCategories} style={{ display: 'none' }} />
                  <button type="button" className="noorix-btn-nav" onClick={handleDownloadCategoriesImportTemplate}>
                    📄 {t('ordersDownloadImportTemplate')}
                  </button>
                  <button type="button" className="noorix-btn-nav" onClick={() => fileInputCategories.current?.click()} disabled={createCategoriesBatch.isPending}>📥 {t('import')}</button>
                  <button type="button" className="noorix-btn-nav" onClick={handleExportCategories} disabled={categories.length === 0}>📤 {t('exportExcel')}</button>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--noorix-text-muted)', maxWidth: 420, textAlign: 'right', lineHeight: 1.45 }}>
                  {t('ordersImportTemplateHintCategories')}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 180 }}>
                <label style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('categoryNameAr')} *</label>
                <input type="text" value={newCategory.nameAr} onChange={(e) => setNewCategory((p) => ({ ...p, nameAr: e.target.value }))} placeholder={t('categoryNameAr')} style={inputStyle} />
              </div>
              <div style={{ minWidth: 180 }}>
                <label style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('categoryNameEn')}</label>
                <input type="text" value={newCategory.nameEn} onChange={(e) => setNewCategory((p) => ({ ...p, nameEn: e.target.value }))} placeholder={t('categoryNameEn')} style={inputStyle} />
              </div>
              <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={handleCreateCategory} disabled={createCategory.isPending || !companyId}>
                {createCategory.isPending ? t('saving') : t('add')}
              </button>
            </div>
          </div>

          <div className="noorix-surface-card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--noorix-border)' }}>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{t('categoryNameAr')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{t('categoryNameEn')}</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 700 }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--noorix-border)' }}>
                    {editingCategory?.id === c.id ? (
                      <>
                        <td style={{ padding: '8px 12px' }}>
                          <input type="text" value={editingCategory.nameAr} onChange={(e) => setEditingCategory((x) => ({ ...x, nameAr: e.target.value }))} placeholder={t('categoryNameAr')} style={{ ...inputStyle, padding: '6px 10px' }} />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input type="text" value={editingCategory.nameEn || ''} onChange={(e) => setEditingCategory((x) => ({ ...x, nameEn: e.target.value }))} placeholder={t('categoryNameEn')} style={{ ...inputStyle, padding: '6px 10px' }} />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <button type="button" className="noorix-btn-nav" onClick={handleUpdateCategory} style={{ marginRight: 4 }}>{t('save')}</button>
                          <button type="button" className="noorix-btn-nav" onClick={() => setEditingCategory(null)}>{t('cancel')}</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '10px 12px' }}>{c.nameAr || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--noorix-text-muted)' }}>{c.nameEn || '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button type="button" className="noorix-btn-nav" onClick={() => setEditingCategory({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn || '' })} style={{ padding: '6px 10px', fontSize: 12 }}>{t('edit')}</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {categories.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{t('ordersNoCategoriesYet')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
