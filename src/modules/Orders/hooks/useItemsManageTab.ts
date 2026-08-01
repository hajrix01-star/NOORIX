import { useState, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  useOrderProducts,
  useOrderCategories,
  useOrderCatalogUnits,
  useOrderConversionTemplates,
  useOrderSections,
  useCreateOrderProductMutation,
  useCreateOrderProductsBatchMutation,
  useCreateOrderCatalogUnitMutation,
  useCreateOrderConversionTemplateMutation,
  useUpdateOrderCatalogUnitMutation,
  useUpdateOrderConversionTemplateMutation,
  useDeleteOrderCatalogUnitMutation,
  useDeleteOrderConversionTemplateMutation,
  useUpdateOrderProductMutation,
  useCreateOrderCategoryMutation,
  useCreateOrderCategoriesBatchMutation,
  useUpdateOrderCategoryMutation,
  useDeleteOrderProductsMutation,
  useDeleteOrderCategoriesMutation,
  useCreateOrderSectionMutation,
  useUpdateOrderSectionMutation,
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
import type {
  OrderCatalogUnitPayload,
  OrderCategory,
  OrderConversionTemplatePayload,
  OrderProduct,
  OrderProductUnitConversion,
  OrderProductVariant,
} from '../../../types/api';
/**
 * State and handlers for the Orders manage-items tab (products and categories).
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
  const [newCatalogUnit, setNewCatalogUnit] = useState<OrderCatalogUnitPayload>({
    code: '',
    nameAr: '',
    nameEn: '',
    kind: 'package',
  });
  const [newConversionTemplate, setNewConversionTemplate] = useState<OrderConversionTemplatePayload>({
    code: '',
    nameAr: '',
    nameEn: '',
    description: '',
    conversions: [],
  });
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
  const { data: catalogUnits = [] } = useOrderCatalogUnits(companyId);
  const { data: conversionTemplates = [] } = useOrderConversionTemplates(companyId);
  const { data: sections = [] } = useOrderSections(companyId);
  const createProduct = useCreateOrderProductMutation(companyId);
  const createProductsBatch = useCreateOrderProductsBatchMutation(companyId);
  const updateProductMutation = useUpdateOrderProductMutation(companyId);
  const deleteProductsMutation = useDeleteOrderProductsMutation(companyId);
  const createCategory = useCreateOrderCategoryMutation(companyId);
  const createCategoriesBatch = useCreateOrderCategoriesBatchMutation(companyId);
  const updateCategory = useUpdateOrderCategoryMutation(companyId);
  const deleteCategoriesMutation = useDeleteOrderCategoriesMutation(companyId);
  const createCatalogUnit = useCreateOrderCatalogUnitMutation(companyId);
  const updateCatalogUnit = useUpdateOrderCatalogUnitMutation(companyId);
  const deleteCatalogUnit = useDeleteOrderCatalogUnitMutation(companyId);
  const createConversionTemplate = useCreateOrderConversionTemplateMutation(companyId);
  const updateConversionTemplate = useUpdateOrderConversionTemplateMutation(companyId);
  const deleteConversionTemplate = useDeleteOrderConversionTemplateMutation(companyId);
  const createSection = useCreateOrderSectionMutation(companyId);
  const updateSection = useUpdateOrderSectionMutation(companyId);
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
  function handleCreateCategory(onDone?: () => void) {
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
          onDone?.();
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

  function handleUpdateCategory(onDone?: () => void) {
    if (!editingCategory?.id) return;
    updateCategory.mutate(
      { id: editingCategory.id, body: { nameAr: editingCategory.nameAr, nameEn: editingCategory.nameEn ?? null } },
      {
        onSuccess: () => {
          showToast(t('ordersCategoryUpdated'), 'success');
          setEditingCategory(null);
          onDone?.();
        },
        onError: (e: Error) => showToast(e?.message || t('updateFailed'), 'error'),
      },
    );
  }

  function handleCreateCatalogUnit(onDone?: () => void) {
    if (!newCatalogUnit.nameAr?.trim()) {
      showToast('اسم الوحدة مطلوب', 'error');
      return;
    }
    createCatalogUnit.mutate(
      {
        companyId,
        ...newCatalogUnit,
        nameAr: newCatalogUnit.nameAr.trim(),
        nameEn: newCatalogUnit.nameEn?.trim() || null,
        code: newCatalogUnit.code?.trim() || undefined,
        kind: newCatalogUnit.kind || 'package',
      },
      {
        onSuccess: () => {
          setNewCatalogUnit({ code: '', nameAr: '', nameEn: '', kind: 'package' });
          showToast('تمت إضافة الوحدة', 'success');
          onDone?.();
        },
        onError: (e: Error) => showToast(e?.message || t('addFailed'), 'error'),
      },
    );
  }

  function handleCreateConversionTemplate(onDone?: () => void) {
    if (!newConversionTemplate.nameAr?.trim()) {
      showToast('اسم التحويل مطلوب', 'error');
      return;
    }
    const conversions = (newConversionTemplate.conversions || []).filter((row) => {
      const multiplier = Number.parseFloat(String(row.multiplier ?? ''));
      return row.fromUnit && row.toUnit && Number.isFinite(multiplier) && multiplier > 0;
    });
    if (conversions.length === 0) {
      showToast('أضف معادلة تحويل واحدة على الأقل', 'error');
      return;
    }
    createConversionTemplate.mutate(
      {
        companyId,
        ...newConversionTemplate,
        nameAr: newConversionTemplate.nameAr.trim(),
        nameEn: newConversionTemplate.nameEn?.trim() || null,
        code: newConversionTemplate.code?.trim() || undefined,
        description: newConversionTemplate.description?.trim() || null,
        conversions,
      },
      {
        onSuccess: () => {
          setNewConversionTemplate({ code: '', nameAr: '', nameEn: '', description: '', conversions: [] });
          showToast('تمت إضافة قالب التحويل', 'success');
          onDone?.();
        },
        onError: (e: Error) => showToast(e?.message || t('addFailed'), 'error'),
      },
    );
  }

  function addConversionTemplateRow() {
    setNewConversionTemplate((current) => ({
      ...current,
      conversions: [
        ...(current.conversions || []),
        { fromUnit: 'kg', toUnit: 'g', multiplier: '', label: '' },
      ],
    }));
  }

  function updateConversionTemplateRow(index: number, patch: Partial<OrderProductUnitConversion>) {
    setNewConversionTemplate((current) => ({
      ...current,
      conversions: (current.conversions || []).map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    }));
  }

  function removeConversionTemplateRow(index: number) {
    setNewConversionTemplate((current) => ({
      ...current,
      conversions: (current.conversions || []).filter((_, rowIndex) => rowIndex !== index),
    }));
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
    catalogUnits,
    conversionTemplates,
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
    updateCategory,
    createCategoriesBatch,
    newCatalogUnit,
    setNewCatalogUnit,
    newConversionTemplate,
    setNewConversionTemplate,
    createCatalogUnit,
    updateCatalogUnit,
    deleteCatalogUnit,
    createConversionTemplate,
    updateConversionTemplate,
    deleteConversionTemplate,
    handleCreateCatalogUnit,
    handleCreateConversionTemplate,
    addConversionTemplateRow,
    updateConversionTemplateRow,
    removeConversionTemplateRow,
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
    updateSection,
    deleteSection,
    bulkSetSections,
  };
}

export type ItemsManageTabController = ReturnType<typeof useItemsManageTab>;
