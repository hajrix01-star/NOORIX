import { useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  useOrderProducts,
  useOrderCategories,
  useOrderSections,
  useCreateOrderProductMutation,
  useCreateOrderProductsBatchMutation,
  useUpdateOrderProductMutation,
  useCreateOrderCategoryMutation,
  useCreateOrderCategoriesBatchMutation,
  useUpdateOrderCategoryMutation,
  useDeleteOrderProductsMutation,
  useDeleteOrderCategoriesMutation,
  useCreateOrderSectionMutation,
  useDeleteOrderSectionMutation,
  useBulkSetProductSectionsMutation,
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
import { orderKeys } from '../../../services/queryKeys';

/**
 * State and handlers for the Orders «manage items» tab (products + categories).
 */
export function useItemsManageTab(companyId: any) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('sections');
  const [catalogProductType, setCatalogProductType] = useState<'order' | 'sale'>('order');
  const { showToast } = useToast();
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({
    nameAr: '',
    nameEn: '',
    categoryId: '',
    sectionIds: [] as string[],
    productType: 'order' as 'order' | 'sale',
    simpleLastPrice: '',
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
  const [productFilterSection, setProductFilterSection] = useState<string>(''); // '' = الكل | '__none__' = بدون قسم | nameAr = قسم محدد
  const [productFilterCategory, setProductFilterCategory] = useState<string>(''); // '' = الكل | categoryId
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

  const { data: products = [] } = useOrderProducts(companyId);
  const { data: categories = [] } = useOrderCategories(companyId);
  const { data: sections = [] } = useOrderSections(companyId);
  const createProduct = useCreateOrderProductMutation(companyId);
  const createProductsBatch = useCreateOrderProductsBatchMutation(companyId);
  const updateProductMutation = useUpdateOrderProductMutation(companyId);
  const deleteProductsMutation = useDeleteOrderProductsMutation(companyId);
  const createCategory = useCreateOrderCategoryMutation(companyId);
  const createCategoriesBatch = useCreateOrderCategoriesBatchMutation(companyId);
  const updateCategory = useUpdateOrderCategoryMutation(companyId);
  const deleteCategoriesMutation = useDeleteOrderCategoriesMutation(companyId);
  const createSection = useCreateOrderSectionMutation(companyId);
  const deleteSection = useDeleteOrderSectionMutation(companyId);
  const bulkSetSections = useBulkSetProductSectionsMutation(companyId);
  const fileInputProducts = useRef<any>(null);
  const fileInputCategories = useRef<any>(null);

  const sizesOptions = useMemo(() => getSizesOptions(companyId || ''), [companyId, sizesKey]);
  const packagingOptions = useMemo(() => getPackagingOptions(companyId || ''), [companyId, packagingKey]);

  const filteredProducts = useMemo(() => {
    let result = products as any[];

    // فلتر البحث النصي
    const q = productSearchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((p: any) => {
        const cat = `${p.category?.nameAr || ''} ${p.category?.nameEn || ''}`.toLowerCase();
        const na = String(p.nameAr || '').toLowerCase();
        const ne = String(p.nameEn || '').toLowerCase();
        const variants = Array.isArray(p.variants) ? p.variants : [];
        const vtxt = variants
          .map((v: any) => `${v.size || ''} ${v.packaging || ''} ${v.unit || ''} ${v.lastPrice ?? ''}`)
          .join(' ')
          .toLowerCase();
        return na.includes(q) || ne.includes(q) || cat.includes(q) || vtxt.includes(q);
      });
    }

    // فلتر الفئة
    if (productFilterCategory) {
      result = result.filter((p: any) => p.categoryId === productFilterCategory);
    }

    // فلتر القسم
    if (productFilterSection === '__none__') {
      result = result.filter((p: any) => !p.sections || (p.sections as string[]).length === 0);
    } else if (productFilterSection) {
      result = result.filter((p: any) => {
        const secs = p.sections as string[] | null;
        return secs && secs.includes(productFilterSection);
      });
    }

    return result;
  }, [products, productSearchQuery, productFilterSection, productFilterCategory]);

  const catalogFilteredProducts = useMemo(
    () => (filteredProducts as any[]).filter((p: any) => (p.productType || 'order') === catalogProductType),
    [filteredProducts, catalogProductType],
  );

  const filteredCategories = useMemo(() => {
    const q = categorySearchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c: any) => {
      const na = String(c.nameAr || '').toLowerCase();
      const ne = String(c.nameEn || '').toLowerCase();
      return na.includes(q) || ne.includes(q);
    });
  }, [categories, categorySearchQuery]);

  function resetNewProductForm(productType: 'order' | 'sale' = catalogProductType) {
    setNewProduct({
      nameAr: '',
      nameEn: '',
      categoryId: '',
      sectionIds: [],
      productType,
      simpleLastPrice: '',
      variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }],
    });
  }

  function buildProductPayload(form: any, productType: 'order' | 'sale') {
    const validVariants = (form.variants || []).filter(
      (v: any) => v.size || v.packaging || (v.unit && v.unit !== 'piece') || parseFloat(v.lastPrice) > 0,
    );
    const sectionIds = Array.isArray(form.sectionIds) ? form.sectionIds.filter(Boolean) : [];
    const base = {
      nameAr: form.nameAr?.trim(),
      nameEn: form.nameEn?.trim() || undefined,
      categoryId: form.categoryId || undefined,
      sectionIds: sectionIds.length > 0 ? sectionIds : undefined,
      productType,
    };
    if (validVariants.length > 0) {
      return {
        ...base,
        variants: validVariants.map((v: any) => ({
          size: v.size || '',
          packaging: v.packaging || '',
          unit: v.unit || 'piece',
          lastPrice: v.lastPrice || '0',
        })),
      };
    }
    const price = String(form.simpleLastPrice ?? form.variants?.[0]?.lastPrice ?? '0').trim() || '0';
    return { ...base, lastPrice: price };
  }

  function handleCreateProduct(onDone?: () => void) {
    if (!newProduct.nameAr?.trim()) {
      showToast(t('ordersProductNameRequired'), 'error');
      return;
    }
    const payload = {
      companyId,
      ...buildProductPayload(newProduct, newProduct.productType || catalogProductType),
    };
    createProduct.mutate(payload, {
      onSuccess: () => {
        showToast(t('ordersProductAdded'), 'success');
        resetNewProductForm(newProduct.productType || catalogProductType);
        onDone?.();
      },
      onError: (e: any) => {
        showToast((e as Error)?.message || (e as { error?: string })?.error || t('addFailed'), 'error');
      },
    });
  }

  function handleUpdateProduct(onDone?: () => void) {
    if (!editingProduct?.id) return;
    const built = buildProductPayload(editingProduct, editingProduct.productType || catalogProductType);
    const validVariants = (editingProduct.variants || []).filter(
      (v: any) => v.size || v.packaging || (v.unit && v.unit !== 'piece') || parseFloat(v.lastPrice) > 0,
    );
    const body = {
      nameAr: built.nameAr,
      nameEn: built.nameEn ?? null,
      categoryId: built.categoryId || null,
      sectionIds: (built as { sectionIds?: string[] }).sectionIds ?? [],
      productType: built.productType,
      ...(validVariants.length > 0
        ? {
            variants: (built as any).variants ?? [],
          }
        : { variants: [], lastPrice: (built as any).lastPrice || '0' }),
    };
    updateProductMutation.mutate(
      { id: editingProduct.id, body },
      {
        onSuccess: () => {
          showToast(t('ordersProductUpdated'), 'success');
          setEditingProduct(null);
          onDone?.();
        },
        onError: (e: any) => {
          showToast((e as Error)?.message || (e as { error?: string })?.error || t('updateFailed'), 'error');
        },
      },
    );
  }

  function openEditProduct(p: any) {
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const hasVariants = variants.some(
      (v: any) => v.size || v.packaging || parseFloat(v.lastPrice) > 0,
    );
    setEditingProduct({
      id: p.id,
      nameAr: p.nameAr,
      nameEn: p.nameEn || '',
      categoryId: p.categoryId || '',
      sectionIds: Array.isArray(p.sectionIds) ? [...p.sectionIds] : [],
      productType: p.productType || catalogProductType,
      simpleLastPrice: hasVariants ? '' : String(p.lastPrice ?? ''),
      variants: hasVariants
        ? variants.map((v: any) => ({
            size: v.size || '',
            packaging: v.packaging || '',
            unit: v.unit || 'piece',
            lastPrice: v.lastPrice ? String(v.lastPrice) : '',
          }))
        : [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }],
      _advanced: hasVariants,
    });
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
        onError: (e: any) => showToast(e?.message || t('addFailed'), 'error'),
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
    setSizesKey((k: any) => k + 1);
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
    setPackagingKey((k: any) => k + 1);
    setNewPackaging({ ar: '', en: '' });
    setAddPackagingModal(false);
    showToast(t('ordersPackagingAdded'), 'success');
  }

  async function handleInsertPresetCatalog() {
    if (!companyId || presetBusy) return;
    setPresetBusy(true);
    try {
      let catRes = await getOrderCategories(companyId);
      const catMap = new Map((catRes?.data ?? []).map((c: any) => [String(c.nameAr ?? '').trim().toLowerCase(), c.id]));
      const presetCategoryNames = [...new Set(BROASTED_PRESET_ORDER_PRODUCTS.map((p: any) => p.categoryAr))];
      const missingCats = presetCategoryNames.filter((n: any) => !catMap.has(String(n).trim().toLowerCase()));
      let catsAdded = 0;
      if (missingCats.length) {
        const batchRes = await createOrderCategoriesBatch(companyId, missingCats.map((nameAr: any) => ({ nameAr })));
        assertApiOk(batchRes, t('addFailed'));
        catsAdded = missingCats.length;
        catRes = await getOrderCategories(companyId);
        (catRes?.data ?? []).forEach((c: any) => catMap.set(String(c.nameAr ?? '').trim().toLowerCase(), c.id));
      }

      const prodRes = await getOrderProducts(companyId);
      const productList = prodRes?.data ?? [];
      const byNameLower = new Map(productList.map((p: any) => [String(p.nameAr ?? '').trim().toLowerCase(), p]));

      const updateTasks = [];
      for (const row of BROASTED_PRESET_ORDER_PRODUCTS) {
        const key = row.nameAr.trim().toLowerCase();
        const ex = byNameLower.get(key);
        if (!ex) continue;
        const cid = catMap.get(row.categoryAr.trim().toLowerCase());
        const { variants, lastPrice, unit } = presetRowToProductPayload(row);
        updateTasks.push({
          id: (ex as { id: string }).id,
          body: { categoryId: cid ?? null, variants, lastPrice, unit },
        });
      }

      const CHUNK = 6;
      let updated = 0;
      for (let i = 0; i < updateTasks.length; i += CHUNK) {
        const chunk = updateTasks.slice(i, i + CHUNK);
        const results = await Promise.all(chunk.map(({ id, body }: any) => updateOrderProduct(id, body, companyId)));
        for (const r of results) {
          assertApiOk(r, t('updateFailed'));
        }
        updated += chunk.length;
      }

      const existingKeys = new Set(productList.map((p: any) => String(p.nameAr ?? '').trim().toLowerCase()));
      const productsPayload = BROASTED_PRESET_ORDER_PRODUCTS.filter((p: any) => !existingKeys.has(p.nameAr.trim().toLowerCase())).map((p: any) => {
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

      queryClient.invalidateQueries({ queryKey: orderKeys.products(companyId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.categories(companyId) });

      if (added === 0 && updated === 0 && catsAdded === 0) {
        showToast(t('ordersPresetNothingDone'), 'success');
      } else {
        showToast(t('ordersPresetDone', String(added), String(updated), String(catsAdded)), 'success');
      }
    } catch (e: any) {
      showToast(e?.message || t('addFailed'), 'error');
    } finally {
      setPresetBusy(false);
    }
  }

  async function handleDownloadProductsImportTemplate(productType: 'order' | 'sale' = 'order') {
    try {
      const filename =
        productType === 'sale'
          ? 'sale-products-import-template.xlsx'
          : 'order-products-import-template.xlsx';
      await exportOrdersProductsImportTemplate(filename, productType);
      showToast(t('ordersImportTemplateReady'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('exportFailed'), 'error');
    }
  }

  async function handleDownloadCategoriesImportTemplate() {
    try {
      await exportOrdersCategoriesImportTemplate('order-categories-import-template.xlsx');
      showToast(t('ordersImportTemplateReady'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('exportFailed'), 'error');
    }
  }

  async function handleExportProducts(productType: 'order' | 'sale' = 'order') {
    try {
      const scoped = (products as any[]).filter((p) => (p.productType || 'order') === productType);
      const filename = productType === 'sale' ? 'sale-products.xlsx' : 'order-products.xlsx';
      await exportOrderProductsWorkbook(scoped, filename);
      showToast(t('exportSuccess'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('exportFailed'), 'error');
    }
  }

  async function handleExportCategories() {
    try {
      await exportOrderCategoriesWorkbook(categories, 'order-categories.xlsx');
      showToast(t('exportSuccess'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('exportFailed'), 'error');
    }
  }

  async function handleImportProducts(e: any, productType: 'order' | 'sale' = 'order') {
    const file = e?.target?.files?.[0];
    if (!file) return;
    try {
      const rawRows = await importFromExcel(file);
      const filtered = filterOrderProductsTemplateRows(rawRows, productType);
      const catByName = new Map(categories.map((c: any) => [String(c.nameAr ?? '').trim().toLowerCase(), c.id]));
      const groups = groupOrderProductImportRows(filtered);
      const toCreate = orderProductImportGroupsToPayload(groups, catByName, productType);
      if (toCreate.length === 0) {
        showToast(t('ordersImportNoValidRows'), 'error');
        return;
      }
      createProductsBatch.mutate(toCreate, {
        onSuccess: (data: any) => {
          showToast(t('ordersImportSuccess', data?.length ?? toCreate.length), 'success');
          if (fileInputProducts.current) fileInputProducts.current.value = '';
        },
        onError: (err: any) => showToast((err as Error)?.message || (err as { error?: string })?.error || t('importFailed'), 'error'),
      });
    } catch (err: any) {
      showToast(err?.message || t('importFailed'), 'error');
    }
  }

  async function handleImportCategories(e: any) {
    const file = e?.target?.files?.[0];
    if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const filtered = filterOrderCategoriesTemplateRows(rows);
      const toCreate = filtered
        .filter((r: any) => r.nameAr || r.name_ar)
        .map((r: any) => ({
          nameAr: String(r.nameAr ?? r.name_ar ?? '').trim(),
          nameEn: String(r.nameEn ?? r.name_en ?? '').trim() || undefined,
        }))
        .filter((r: any) => r.nameAr);
      if (toCreate.length === 0) {
        showToast(t('ordersImportNoValidRows'), 'error');
        return;
      }
      createCategoriesBatch.mutate(toCreate, {
        onSuccess: (data: any) => {
          showToast(t('ordersImportSuccess', data?.length ?? toCreate.length), 'success');
          if (fileInputCategories.current) fileInputCategories.current.value = '';
        },
        onError: (err: any) => showToast(err?.message || t('importFailed'), 'error'),
      });
    } catch (err: any) {
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
        onError: (e: any) => showToast(e?.message || t('updateFailed'), 'error'),
      },
    );
  }

  function toggleProductSelection(id: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllProducts(ids: string[]) {
    setSelectedProductIds((prev) =>
      prev.size === ids.length ? new Set() : new Set(ids),
    );
  }

  function toggleCategorySelection(id: string) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllCategories(ids: string[]) {
    setSelectedCategoryIds((prev) =>
      prev.size === ids.length ? new Set() : new Set(ids),
    );
  }

  function handleDeleteSelectedProducts() {
    const ids = [...selectedProductIds];
    if (!ids.length) return;
    if (!window.confirm(t('ordersProductDeactivateConfirm'))) return;
    deleteProductsMutation.mutate(ids, {
      onSuccess: (res: any) => {
        const n = res?.data?.deleted ?? ids.length;
        showToast(t('ordersProductsDeleted', String(n)), 'success');
        setSelectedProductIds(new Set());
      },
      onError: (e: any) => showToast(e?.message || t('deleteFailed'), 'error'),
    });
  }

  function handleDeleteSelectedCategories() {
    const ids = [...selectedCategoryIds];
    if (!ids.length) return;
    deleteCategoriesMutation.mutate(ids, {
      onSuccess: (res: any) => {
        const n = res?.data?.deleted ?? ids.length;
        showToast(t('ordersCategoriesDeleted', String(n)), 'success');
        setSelectedCategoryIds(new Set());
      },
      onError: (e: any) => showToast(e?.message || t('deleteFailed'), 'error'),
    });
  }

  function addVariantToProduct() {
    setNewProduct((p: any) => ({
      ...p,
      variants: [...(p.variants || []), { size: '', packaging: '', unit: 'piece', lastPrice: '' }],
    }));
  }

  function updateNewProductVariant(idx: any, field: any, value: any) {
    setNewProduct((p: any) => {
      const v = [...(p.variants || [])];
      if (!v[idx]) return p;
      v[idx] = { ...v[idx], [field]: value };
      return { ...p, variants: v };
    });
  }

  function removeNewProductVariant(idx: any) {
    setNewProduct((p: any) => ({ ...p, variants: (p.variants || []).filter((_: any, i: any) => i !== idx) }));
  }

  function updateEditingVariant(idx: any, field: any, value: any) {
    setEditingProduct((p: any) => {
      const v = [...(p.variants || [])];
      if (!v[idx]) return p;
      v[idx] = { ...v[idx], [field]: value };
      return { ...p, variants: v };
    });
  }

  function removeEditingVariant(idx: any) {
    setEditingProduct((p: any) => ({ ...p, variants: (p.variants || []).filter((_: any, i: any) => i !== idx) }));
  }

  return {
    t,
    companyId,
    activeSubTab,
    setActiveSubTab,
    catalogProductType,
    setCatalogProductType,
    catalogFilteredProducts,
    resetNewProductForm,
    openEditProduct,
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
    productFilterSection,
    setProductFilterSection,
    productFilterCategory,
    setProductFilterCategory,
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
    selectedProductIds,
    selectedCategoryIds,
    toggleProductSelection,
    toggleAllProducts,
    toggleCategorySelection,
    toggleAllCategories,
    handleDeleteSelectedProducts,
    handleDeleteSelectedCategories,
    deleteProductsMutation,
    deleteCategoriesMutation,
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
    sections,
    createSection,
    deleteSection,
    bulkSetSections,
  };
}
