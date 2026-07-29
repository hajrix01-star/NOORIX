import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
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
import { BROASTED_PRESET_ORDER_PRODUCTS, presetRowToProductPayload } from '../data/broastedPresetCatalog';
import {
  getOrderCategories,
  getOrderProducts,
  createOrderCategoriesBatch,
  createOrderProductsBatch,
  updateOrderProduct,
  throwIfApiFailed,
} from '../../../services/api';
import { orderKeys } from '../../../services/queryKeys';
import type { OrderCategory, OrderProduct, OrderProductPayload, OrderProductType } from '../../../types/api';

type ImportWorkbookRow = Record<string, unknown>;

type BatchMutation<TPayload> = {
  mutate: (
    payload: TPayload[],
    options: {
      onSuccess: (data: unknown) => void;
      onError: (error: Error & { error?: string }) => void;
    },
  ) => void;
};

export function useItemsManageTabCatalogIo({
  companyId,
  products,
  categories,
  createProductsBatch,
  createCategoriesBatch,
}: {
  companyId: string;
  products: OrderProduct[];
  categories: OrderCategory[];
  createProductsBatch: BatchMutation<OrderProductPayload>;
  createCategoriesBatch: BatchMutation<{ nameAr: string; nameEn?: string }>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const fileInputProducts = useRef<HTMLInputElement | null>(null);
  const fileInputCategories = useRef<HTMLInputElement | null>(null);
  const [presetBusy, setPresetBusy] = useState(false);

  async function handleInsertPresetCatalog() {
    if (!companyId || presetBusy) return;
    setPresetBusy(true);
    try {
      let catRes = await getOrderCategories(companyId);
      const catMap = new Map((catRes?.data ?? []).map((category) => [
        String(category.nameAr ?? '').trim().toLowerCase(),
        category.id,
      ]));
      const presetCategoryNames = [...new Set(BROASTED_PRESET_ORDER_PRODUCTS.map((product) => product.categoryAr))];
      const missingCats = presetCategoryNames.filter((name) => !catMap.has(String(name).trim().toLowerCase()));
      let catsAdded = 0;

      if (missingCats.length) {
        const batchRes = await createOrderCategoriesBatch(companyId, missingCats.map((nameAr) => ({ nameAr })));
        throwIfApiFailed(batchRes, t('addFailed'));
        catsAdded = missingCats.length;
        catRes = await getOrderCategories(companyId);
        (catRes?.data ?? []).forEach((category) =>
          catMap.set(String(category.nameAr ?? '').trim().toLowerCase(), category.id),
        );
      }

      const prodRes = await getOrderProducts(companyId);
      const productList = prodRes?.data ?? [];
      const byNameLower = new Map(productList.map((product) => [
        String(product.nameAr ?? '').trim().toLowerCase(),
        product,
      ]));

      const updateTasks = [];
      for (const row of BROASTED_PRESET_ORDER_PRODUCTS) {
        const key = row.nameAr.trim().toLowerCase();
        const existing = byNameLower.get(key);
        if (!existing) continue;
        const categoryId = catMap.get(row.categoryAr.trim().toLowerCase());
        const { variants, lastPrice, unit } = presetRowToProductPayload(row);
        updateTasks.push({
          id: (existing as { id: string }).id,
          body: { categoryId: categoryId ?? null, variants, lastPrice, unit },
        });
      }

      const chunkSize = 6;
      let updated = 0;
      for (let i = 0; i < updateTasks.length; i += chunkSize) {
        const chunk = updateTasks.slice(i, i + chunkSize);
        const results = await Promise.all(chunk.map(({ id, body }) => updateOrderProduct(id, body, companyId)));
        for (const result of results) {
          throwIfApiFailed(result, t('updateFailed'));
        }
        updated += chunk.length;
      }

      const existingKeys = new Set(productList.map((product) => String(product.nameAr ?? '').trim().toLowerCase()));
      const productsPayload = BROASTED_PRESET_ORDER_PRODUCTS.filter(
        (product) => !existingKeys.has(product.nameAr.trim().toLowerCase()),
      ).map((product) => {
        const { variants, lastPrice, unit } = presetRowToProductPayload(product);
        return {
          nameAr: product.nameAr,
          categoryId: catMap.get(product.categoryAr.trim().toLowerCase()) || undefined,
          variants,
          lastPrice,
          unit,
        };
      });

      let added = 0;
      if (productsPayload.length) {
        const batchRes = await createOrderProductsBatch(companyId, productsPayload);
        throwIfApiFailed(batchRes, t('addFailed'));
        added = productsPayload.length;
      }

      queryClient.invalidateQueries({ queryKey: orderKeys.products(companyId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.categories(companyId) });

      if (added === 0 && updated === 0 && catsAdded === 0) {
        showToast(t('ordersPresetNothingDone'), 'success');
      } else {
        showToast(t('ordersPresetDone', String(added), String(updated), String(catsAdded)), 'success');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('addFailed'), 'error');
    } finally {
      setPresetBusy(false);
    }
  }

  async function handleDownloadProductsImportTemplate(productType: OrderProductType = 'order') {
    try {
      const filename =
        productType === 'sale'
          ? 'sale-products-import-template.xlsx'
          : 'order-products-import-template.xlsx';
      await exportOrdersProductsImportTemplate(filename, productType);
      showToast(t('ordersImportTemplateReady'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('exportFailed'), 'error');
    }
  }

  async function handleDownloadCategoriesImportTemplate() {
    try {
      await exportOrdersCategoriesImportTemplate('order-categories-import-template.xlsx');
      showToast(t('ordersImportTemplateReady'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('exportFailed'), 'error');
    }
  }

  async function handleExportProducts(productType: OrderProductType = 'order') {
    try {
      const scoped = products.filter((product) => (product.productType || 'order') === productType);
      const filename = productType === 'sale' ? 'sale-products.xlsx' : 'order-products.xlsx';
      await exportOrderProductsWorkbook(scoped, filename);
      showToast(t('exportSuccess'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('exportFailed'), 'error');
    }
  }

  async function handleExportCategories() {
    try {
      await exportOrderCategoriesWorkbook(categories, 'order-categories.xlsx');
      showToast(t('exportSuccess'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('exportFailed'), 'error');
    }
  }

  async function handleImportProducts(event: React.ChangeEvent<HTMLInputElement>, productType: OrderProductType = 'order') {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const rawRows = await importFromExcel(file);
      const filtered = filterOrderProductsTemplateRows(rawRows, productType);
      const catByName = new Map(categories.map((category) => [
        String(category.nameAr ?? '').trim().toLowerCase(),
        category.id,
      ]));
      const groups = groupOrderProductImportRows(filtered);
      const toCreate = orderProductImportGroupsToPayload(groups, catByName, productType);
      if (toCreate.length === 0) {
        showToast(t('ordersImportNoValidRows'), 'error');
        return;
      }

      createProductsBatch.mutate(toCreate, {
        onSuccess: (data: unknown) => {
          const count = Array.isArray(data) ? data.length : toCreate.length;
          showToast(t('ordersImportSuccess', count), 'success');
          if (fileInputProducts.current) fileInputProducts.current.value = '';
        },
        onError: (error) => showToast(error.message || error.error || t('importFailed'), 'error'),
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('importFailed'), 'error');
    }
  }

  async function handleImportCategories(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const toCreate = filterOrderCategoriesTemplateRows(rows)
        .filter((row: ImportWorkbookRow) => row.nameAr || row.name_ar)
        .map((row: ImportWorkbookRow) => ({
          nameAr: String(row.nameAr ?? row.name_ar ?? '').trim(),
          nameEn: String(row.nameEn ?? row.name_en ?? '').trim() || undefined,
        }))
        .filter((row) => row.nameAr);

      if (toCreate.length === 0) {
        showToast(t('ordersImportNoValidRows'), 'error');
        return;
      }

      createCategoriesBatch.mutate(toCreate, {
        onSuccess: (data: unknown) => {
          const count = Array.isArray(data) ? data.length : toCreate.length;
          showToast(t('ordersImportSuccess', count), 'success');
          if (fileInputCategories.current) fileInputCategories.current.value = '';
        },
        onError: (error) => showToast(error.message || t('importFailed'), 'error'),
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('importFailed'), 'error');
    }
  }

  return {
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
  };
}
