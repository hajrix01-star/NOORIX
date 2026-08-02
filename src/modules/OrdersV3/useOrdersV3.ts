import {
  createOrdersV3Category,
  createOrdersV3Document,
  createOrdersV3Item,
  createOrdersV3Location,
  createOrdersV3Section,
  createOrdersV3Stocktake,
  createOrdersV3Unit,
  deactivateOrdersV3Catalog,
  getOrdersV3Balances,
  getOrdersV3Bootstrap,
  getOrdersV3DataQuality,
  getOrdersV3Documents,
  getOrdersV3ItemsReport,
  getOrdersV3Ledger,
  getOrdersV3SalesReport,
  getOrdersV3Stocktakes,
  getOrdersV3Summary,
  publishOrdersV3Conversion,
  publishOrdersV3Recipe,
  reverseOrdersV3Document,
} from '../../services/api';
import type {
  OrdersV3Bootstrap,
  OrdersV3DataQuality,
  OrdersV3Document,
  OrdersV3DocumentPayload,
  OrdersV3InventoryBalance,
  OrdersV3ItemsReportRow,
  OrdersV3LedgerEntry,
  OrdersV3SalesReport,
  OrdersV3Stocktake,
  OrdersV3Summary,
} from '../../types/api';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useApiListQuery, useApiQuery } from '../../hooks/useApiQuery';

export const ordersV3Keys = {
  root: ['orders-v3'] as const,
  bootstrap: (companyId: string) => ['orders-v3', 'bootstrap', companyId] as const,
  documents: (companyId: string, type: string, startDate: string, endDate: string) => ['orders-v3', 'documents', companyId, type, startDate, endDate] as const,
  reports: (companyId: string) => ['orders-v3', 'reports', companyId] as const,
  inventory: (companyId: string) => ['orders-v3', 'inventory', companyId] as const,
};

export function useOrdersV3Bootstrap(companyId: string) {
  return useApiQuery<OrdersV3Bootstrap>({
    queryKey: ordersV3Keys.bootstrap(companyId),
    queryFn: () => getOrdersV3Bootstrap(companyId),
    fallbackMessage: 'تعذر تحميل كتالوج طلبات 2',
    enabled: !!companyId,
  });
}

export function useOrdersV3Documents(companyId: string, type: 'purchase' | 'registration', startDate: string, endDate: string) {
  return useApiListQuery<OrdersV3Document>({
    queryKey: ordersV3Keys.documents(companyId, type, startDate, endDate),
    queryFn: () => getOrdersV3Documents(companyId, type, startDate, endDate),
    fallbackMessage: 'تعذر تحميل مستندات طلبات 2',
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

export function useOrdersV3Summary(companyId: string, startDate: string, endDate: string, enabled = true) {
  return useApiQuery<OrdersV3Summary>({
    queryKey: [...ordersV3Keys.reports(companyId), 'summary', startDate, endDate],
    queryFn: () => getOrdersV3Summary(companyId, startDate, endDate),
    fallbackMessage: 'تعذر تحميل ملخص طلبات 2',
    enabled: enabled && !!companyId && !!startDate && !!endDate,
  });
}

export function useOrdersV3ItemsReport(companyId: string, type: 'purchase' | 'registration' | '', startDate: string, endDate: string) {
  return useApiListQuery<OrdersV3ItemsReportRow>({
    queryKey: [...ordersV3Keys.reports(companyId), 'items', type, startDate, endDate],
    queryFn: () => getOrdersV3ItemsReport(companyId, type, startDate, endDate),
    fallbackMessage: 'تعذر تحميل تقرير أصناف V3',
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

export function useOrdersV3SalesReport(companyId: string, startDate: string, endDate: string) {
  return useApiQuery<OrdersV3SalesReport>({
    queryKey: [...ordersV3Keys.reports(companyId), 'sales', startDate, endDate],
    queryFn: () => getOrdersV3SalesReport(companyId, startDate, endDate),
    fallbackMessage: 'تعذر تحميل تقرير التسجيل الداخلي V3',
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

export function useOrdersV3Balances(companyId: string) {
  return useApiListQuery<OrdersV3InventoryBalance>({
    queryKey: [...ordersV3Keys.inventory(companyId), 'balances'],
    queryFn: () => getOrdersV3Balances(companyId),
    fallbackMessage: 'تعذر تحميل أرصدة V3',
    enabled: !!companyId,
  });
}

export function useOrdersV3Ledger(companyId: string) {
  return useApiListQuery<OrdersV3LedgerEntry>({
    queryKey: [...ordersV3Keys.inventory(companyId), 'ledger'],
    queryFn: () => getOrdersV3Ledger(companyId),
    fallbackMessage: 'تعذر تحميل دفتر V3',
    enabled: !!companyId,
  });
}

export function useOrdersV3Stocktakes(companyId: string) {
  return useApiListQuery<OrdersV3Stocktake>({
    queryKey: [...ordersV3Keys.inventory(companyId), 'stocktakes'],
    queryFn: () => getOrdersV3Stocktakes(companyId),
    fallbackMessage: 'تعذر تحميل سجل الجرد V3',
    enabled: !!companyId,
  });
}

export function useOrdersV3DataQuality(companyId: string) {
  return useApiQuery<OrdersV3DataQuality>({
    queryKey: [...ordersV3Keys.inventory(companyId), 'quality'],
    queryFn: () => getOrdersV3DataQuality(companyId),
    fallbackMessage: 'تعذر تحميل جودة بيانات V3',
    enabled: !!companyId,
  });
}

export function useCreateOrdersV3Document(companyId: string) {
  return useApiMutation({
    mutationFn: (body: OrdersV3DocumentPayload) => createOrdersV3Document(companyId, body),
    invalidateQueries: [ordersV3Keys.root],
    successToast: 'تم اعتماد مستند V3 وحساب حركاته مركزياً',
    showErrorToast: true,
  });
}

export function useReverseOrdersV3Document(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) => reverseOrdersV3Document(companyId, id, idempotencyKey),
    invalidateQueries: [ordersV3Keys.root],
    successToast: 'تم عكس مستند V3',
  });
}

export function useCreateOrdersV3Stocktake(companyId: string) {
  return useApiMutation({
    mutationFn: (body: { stocktakeDate: string; locationId: string; notes?: string; idempotencyKey: string; lines: Array<{ itemId: string; physicalQuantity: string }> }) => createOrdersV3Stocktake(companyId, body),
    invalidateQueries: [ordersV3Keys.root],
    successToast: 'تم اعتماد جرد V3 وتسجيل فروق الدفتر',
  });
}

export function useOrdersV3CatalogMutations(companyId: string) {
  const invalidateQueries = [ordersV3Keys.bootstrap(companyId), ordersV3Keys.inventory(companyId)];
  return {
    createUnit: useApiMutation({ mutationFn: (body: { code: string; nameAr: string; nameEn?: string; dimension: string; canonicalFactor?: string | null }) => createOrdersV3Unit(companyId, body), invalidateQueries, showErrorToast: true }),
    createCategory: useApiMutation({ mutationFn: (body: { nameAr: string; nameEn?: string }) => createOrdersV3Category(companyId, body), invalidateQueries, showErrorToast: true }),
    createSection: useApiMutation({ mutationFn: (body: { code?: string; nameAr: string; nameEn?: string }) => createOrdersV3Section(companyId, body), invalidateQueries, showErrorToast: true }),
    createLocation: useApiMutation({ mutationFn: (body: { code?: string; nameAr: string; nameEn?: string; kind?: string; sectionId?: string | null }) => createOrdersV3Location(companyId, body), invalidateQueries, showErrorToast: true }),
    createItem: useApiMutation({ mutationFn: (body: { sku?: string; nameAr: string; nameEn?: string; itemType: 'purchased' | 'sale' | 'both'; categoryId?: string | null; baseUnitId: string; sectionIds?: string[]; trackInventory?: boolean }) => createOrdersV3Item(companyId, body), invalidateQueries, showErrorToast: true }),
    publishConversion: useApiMutation({ mutationFn: (body: { itemId: string; edges: Array<{ fromUnitId: string; toUnitId: string; factor: string; reversible?: boolean; allowDimensionBridge?: boolean }> }) => publishOrdersV3Conversion(companyId, body), invalidateQueries, showErrorToast: true }),
    publishRecipe: useApiMutation({ mutationFn: (body: { outputItemId: string; outputQuantity: string; outputUnitId: string; lines: Array<{ componentItemId: string; quantity: string; unitId: string; wastePercent?: string }> }) => publishOrdersV3Recipe(companyId, body), invalidateQueries, showErrorToast: true }),
    deactivate: useApiMutation({ mutationFn: ({ entity, id }: { entity: string; id: string }) => deactivateOrdersV3Catalog(companyId, entity, id), invalidateQueries, showErrorToast: true }),
  };
}
