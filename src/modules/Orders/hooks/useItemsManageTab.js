import { useState, useRef, useMemo } from 'react';
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
import { BROASTED_PRESET_ORDER_PRODUCTS, presetRowToProductPayload } from '../data/broastedPresetCatalog';
import {
  getOrderCategories,
  getOrderProducts,
  createOrderCategoriesBatch,
  createOrderProductsBatch,
  updateOrderProduct,
} from '../../../services/api';
import { assertApiOk } from '../../../utils/apiResponse';

/**
 * State and handlers for the Orders «manage items» tab (products + categories).
 */
export function useItemsManageTab(companyId) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('products');
  const { showToast } = useToast();
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newProduct, setNewProduct] = useState({
    nameAr: '',
    nameEn: '',
    categoryId: '',
    variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }],
  });
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
  const updateProductMutation = useUpdateOrderProductMutation(companyId);
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
    const validVariants = (newProduct.variants || []).filter(
      (v) => v.size || v.packaging || v.unit || parseFloat(v.lastPrice) > 0,
    );
    const payload = {
      companyId,
      nameAr: newProduct.nameAr.trim(),
      nameEn: newProduct.nameEn?.trim() || undefined,
      categoryId: newProduct.categoryId || undefined,
      variants:
        validVariants.length > 0
          ? validVariants.map((v) => ({
              size: v.size || '',
              packaging: v.packaging || '',
              unit: v.unit || 'piece',
              lastPrice: v.lastPrice || '0',
            }))
          : undefined,
    };
    createProduct.mutate(payload, {
      onSuccess: () => {
        showToast(t('ordersProductAdded'), 'success');
        setNewProduct({
          nameAr: '',
          nameEn: '',
          categoryId: '',
          variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }],
        });
      },
      onError: (e) => {
        showToast(e?.message || e?.error || t('addFailed'), 'error');
      },
    });
  }

  function handleUpdateProduct() {
    if (!editingProduct?.id) return;
    const validVariants = (editingProduct.variants || []).filter(
      (v) => v.size || v.packaging || v.unit || parseFloat(v.lastPrice) > 0,
    );
    const body = {
      nameAr: editingProduct.nameAr,
      nameEn: editingProduct.nameEn ?? null,
      categoryId: editingProduct.categoryId || null,
      variants:
        validVariants.length > 0
          ? validVariants.map((v) => ({
              size: v.size || '',
              packaging: v.packaging || '',
              unit: v.unit || 'piece',
              lastPrice: v.lastPrice || '0',
            }))
          : [],
    };
    updateProductMutation.mutate(
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
      showToast(t('ordersSizeNameRequired'), 'error');
      return;
    }
    addCustomSize(companyId, ar, newSize.en);
    setSizesKey((k) => k + 1);
    setNewSize({ ar: '', en: '' });
    setAddSizeModal(false);
    showToast(t('ordersSizeAdded'), 'success');
  }

  function handleAddPackaging() {
    const ar = (newPackaging.ar || '').trim();
    if (!ar) {
      showToast(t('ordersPackagingNameRequired'), 'error');
      return;
    }
    addCustomPackaging(companyId, ar, newPackaging.en);
    setPackagingKey((k) => k + 1);
    setNewPackaging({ ar: '', en: '' });
    setAddPackagingModal(false);
    showToast(t('ordersPackagingAdded'), 'success');
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
    setNewProduct((p) => ({
      ...p,
      variants: [...(p.variants || []), { size: '', packaging: '', unit: 'piece', lastPrice: '' }],
    }));
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

  return {
    t,
    companyId,
    activeSubTab,
    setActiveSubTab,
    addSizeModal,
    setAddSizeModal,
    addPackagingModal,
    setAddPackagingModal,
    newSize,
    setNewSize,
    newPackaging,
    setNewPackaging,
    handleAddSize,
    handleAddPackaging,
    newProduct,
    setNewProduct,
    editingProduct,
    setEditingProduct,
    newCategory,
    setNewCategory,
    editingCategory,
    setEditingCategory,
    presetBusy,
    productSearchQuery,
    setProductSearchQuery,
    categorySearchQuery,
    setCategorySearchQuery,
    products,
    categories,
    filteredProducts,
    filteredCategories,
    sizesOptions,
    packagingOptions,
    fileInputProducts,
    fileInputCategories,
    createProduct,
    createProductsBatch,
    updateProduct: updateProductMutation,
    createCategory,
    createCategoriesBatch,
    handleInsertPresetCatalog,
    handleDownloadProductsImportTemplate,
    handleDownloadCategoriesImportTemplate,
    handleExportProducts,
    handleExportCategories,
    handleImportProducts,
    handleImportCategories,
    handleCreateProduct,
    handleUpdateProduct,
    handleCreateCategory,
    handleUpdateCategory,
    addVariantToProduct,
    updateNewProductVariant,
    removeNewProductVariant,
    updateEditingVariant,
    removeEditingVariant,
  };
}
