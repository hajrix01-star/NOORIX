import { useState, useMemo } from 'react';
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
import { useToast } from '../../../context/ToastContext';
import {
  getSizesOptions,
  getPackagingOptions,
  addCustomSize,
  addCustomPackaging,
} from '../constants/orderDefaults';
import { useItemsManageTabCatalogIo } from './useItemsManageTabCatalogIo';
import {
  buildEditableOrderProduct,
  buildOrderProductPayload,
  buildOrderProductUpdateBody,
  createEmptyOrderProductForm,
  type EditableOrderProduct,
  filterOrderCategoriesForManageTab,
  filterOrderProductsForManageTab,
} from '../utils/itemsManageModel';
import { useItemsManageTabSelection } from './useItemsManageTabSelection';
import type { OrderCategory, OrderProduct, OrderProductVariant } from '../../../types/api';
/**
 * State and handlers for the Orders Â«manage itemsÂ» tab (products + categories).
 */
export function useItemsManageTab(companyId: string) {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState('sections');
  const [catalogProductType, setCatalogProductType] = useState<'order' | 'sale'>('order');
  const { showToast } = useToast();
  const [editingProduct, setEditingProduct] = useState<EditableOrderProduct | null>(null);
  const [editingCategory, setEditingCategory] = useState<OrderCategory | null>(null);
  const [newProduct, setNewProduct] = useState(createEmptyOrderProductForm('order'));
  const [newCategory, setNewCategory] = useState({ nameAr: '', nameEn: '' });
  const [addSizeModal, setAddSizeModal] = useState(false);
  const [addPackagingModal, setAddPackagingModal] = useState(false);
  const [newSize, setNewSize] = useState({ ar: '', en: '' });
  const [newPackaging, setNewPackaging] = useState({ ar: '', en: '' });
  const [sizesKey, setSizesKey] = useState(0);
  const [packagingKey, setPackagingKey] = useState(0);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productFilterSection, setProductFilterSection] = useState<string>('');
  const [productFilterCategory, setProductFilterCategory] = useState<string>('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
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
  const catalogIo = useItemsManageTabCatalogIo({
    companyId,
    products,
    categories,
    createProductsBatch,
    createCategoriesBatch,
  });
  const selection = useItemsManageTabSelection({
    t,
    showToast,
    deleteProductsMutation,
    deleteCategoriesMutation,
  });
  const {
    presetBusy,
    fileInputProducts,
    fileInputCategories,
    handleInsertPresetCatalog,
    handleDownloadProductsImportTemplate,
    handleDownloadCategoriesImportTemplate,
    handleExportProducts,
    handleExportCategories,
    handleImportProducts,
    handleImportCategories,
  } = catalogIo;
  const {
    selectedProductIds,
    selectedCategoryIds,
    toggleProductSelection,
    toggleAllProducts,
    toggleCategorySelection,
    toggleAllCategories,
    handleDeleteSelectedProducts,
    handleDeleteSelectedCategories,
  } = selection;
  const sizesOptions = useMemo(() => getSizesOptions(companyId || ''), [companyId, sizesKey]);
  const packagingOptions = useMemo(() => getPackagingOptions(companyId || ''), [companyId, packagingKey]);
  const filteredProducts = useMemo(
    () => filterOrderProductsForManageTab(products, productSearchQuery, productFilterSection, productFilterCategory),
    [products, productSearchQuery, productFilterSection, productFilterCategory],
  );
  const catalogFilteredProducts = useMemo(
    () => filteredProducts.filter((p) => (p.productType || 'order') === catalogProductType),
    [filteredProducts, catalogProductType],
  );
  const filteredCategories = useMemo(
    () => filterOrderCategoriesForManageTab(categories, categorySearchQuery),
    [categories, categorySearchQuery],
  );
  function resetNewProductForm(productType: 'order' | 'sale' = catalogProductType) {
    setNewProduct(createEmptyOrderProductForm(productType));
  }
  function handleCreateProduct(onDone?: () => void) {
    if (!newProduct.nameAr?.trim()) {
      showToast(t('ordersProductNameRequired'), 'error');
      return;
    }
    const payload = {
      companyId,
      ...buildOrderProductPayload(newProduct, newProduct.productType || catalogProductType),
    };
    createProduct.mutate(payload, {
      onSuccess: () => {
        showToast(t('ordersProductAdded'), 'success');
        resetNewProductForm(newProduct.productType || catalogProductType);
        onDone?.();
      },
      onError: (e: Error & { error?: string }) => {
        showToast((e as Error)?.message || (e as { error?: string })?.error || t('addFailed'), 'error');
      },
    });
  }
  function handleUpdateProduct(onDone?: () => void) {
    if (!editingProduct?.id) return;
    updateProductMutation.mutate(
      { id: editingProduct.id, body: buildOrderProductUpdateBody(editingProduct, catalogProductType) },
      {
        onSuccess: () => {
          showToast(t('ordersProductUpdated'), 'success');
          setEditingProduct(null);
          onDone?.();
        },
        onError: (e: Error & { error?: string }) => {
          showToast((e as Error)?.message || (e as { error?: string })?.error || t('updateFailed'), 'error');
        },
      },
    );
  }
  function openEditProduct(p: OrderProduct) {
    setEditingProduct(buildEditableOrderProduct(p, catalogProductType));
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
        onError: (e: Error) => showToast(e?.message || t('addFailed'), 'error'),
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

  function handleUpdateCategory() {
    if (!editingCategory?.id) return;
    updateCategory.mutate(
      { id: editingCategory.id, body: { nameAr: editingCategory.nameAr, nameEn: editingCategory.nameEn ?? null } },
      {
        onSuccess: () => {
          showToast(t('ordersCategoryUpdated'), 'success');
          setEditingCategory(null);
        },
        onError: (e: Error) => showToast(e?.message || t('updateFailed'), 'error'),
      },
    );
  }

  function addVariantToProduct() {
    setNewProduct((p) => ({
      ...p,
      variants: [...(p.variants || []), { size: '', packaging: '', unit: 'piece', lastPrice: '', quantityMultiplier: '1' }],
    }));
  }

  function updateNewProductVariant(idx: number, field: keyof OrderProductVariant, value: string) {
    setNewProduct((p) => {
      const v = [...(p.variants || [])];
      if (!v[idx]) return p;
      v[idx] = { ...v[idx], [field]: value };
      return { ...p, variants: v };
    });
  }

  function removeNewProductVariant(idx: number) {
    setNewProduct((p) => ({ ...p, variants: (p.variants || []).filter((_, i) => i !== idx) }));
  }

  function updateEditingVariant(idx: number, field: keyof OrderProductVariant, value: string) {
    setEditingProduct((p) => {
      if (!p) return p;
      const v = [...(p.variants || [])];
      if (!v[idx]) return p;
      v[idx] = { ...v[idx], [field]: value };
      return { ...p, variants: v };
    });
  }

  function removeEditingVariant(idx: number) {
    setEditingProduct((p) => p ? ({ ...p, variants: (p.variants || []).filter((_, i) => i !== idx) }) : p);
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

export type ItemsManageTabController = ReturnType<typeof useItemsManageTab>;
