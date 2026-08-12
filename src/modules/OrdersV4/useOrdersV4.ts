import {
  createOrdersV4Category,
  createOrdersV4Document,
  createOrdersV4Item,
  createOrdersV4Location,
  createOrdersV4Section,
  createOrdersV4Stocktake,
  createOrdersV4Unit,
  deactivateOrdersV4Catalog,
  getOrdersV4Balances,
  getOrdersV4ActivityReport,
  getOrdersV4Bootstrap,
  getOrdersV4DataQuality,
  getOrdersV4Documents,
  getOrdersV4ItemsReport,
  getOrdersV4Ledger,
  getOrdersV4SalesReport,
  getOrdersV4Stocktakes,
  getOrdersV4Summary,
  publishOrdersV4Recipe,
  previewOrdersV4Document,
  reverseOrdersV4Document,
  undoReverseOrdersV4Document,
  receiveOrdersV4Document,
  reopenOrdersV4Document,
  restoreOrdersV4Unit,
  saveOrdersV4ItemDefinition,
  updateOrdersV4Category,
  updateOrdersV4Item,
  updateOrdersV4Section,
} from '../../services/api';
import type {
  OrdersV4Bootstrap,
  OrdersV4ActivityReport,
  OrdersV4DataQuality,
  OrdersV4Document,
  OrdersV4DocumentPayload,
  OrdersV4DocumentPreviewPayload,
  OrdersV4ReceivePayload,
  OrdersV4InventoryBalance,
  OrdersV4ItemsReportRow,
  OrdersV4LedgerEntry,
  OrdersV4ReportFilters,
  OrdersV4SalesReport,
  OrdersV4Stocktake,
  OrdersV4Summary,
} from '../../types/api';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useApiListQuery, useApiQuery } from '../../hooks/useApiQuery';
import { ordersV4Keys } from '../../services/queryKeys';

export { ordersV4Keys } from '../../services/queryKeys';

export function useOrdersV4Bootstrap(companyId: string, enabled = true) {
  return useApiQuery<OrdersV4Bootstrap>({
    queryKey: ordersV4Keys.bootstrap(companyId),
    queryFn: () => getOrdersV4Bootstrap(companyId),
    fallbackMessage: 'تعذر تحميل كتالوج طلبات V4',
    enabled: enabled && !!companyId,
  });
}

export function useOrdersV4Documents(
  companyId: string,
  type: 'purchase' | 'registration',
  startDate: string,
  endDate: string,
  enabled = true,
  limit = 250,
  filters: { search?: string; sectionId?: string; categoryId?: string; itemId?: string; paymentMethod?: string; status?: string } = {},
) {
  return useApiListQuery<OrdersV4Document>({
    queryKey: [...ordersV4Keys.documents(companyId, type, startDate, endDate, limit), filters],
    queryFn: () => getOrdersV4Documents(companyId, type, startDate, endDate, limit, filters),
    fallbackMessage: 'تعذر تحميل مستندات طلبات V4',
    enabled: enabled && !!companyId && !!startDate && !!endDate,
  });
}

export function useOrdersV4ActivityReport(companyId: string, type: 'purchase' | 'registration' | '', startDate: string, endDate: string, filters: OrdersV4ReportFilters = {}) {
  return useApiQuery<OrdersV4ActivityReport>({
    queryKey: [...ordersV4Keys.reports(companyId), 'activity', type, startDate, endDate, filters],
    queryFn: () => getOrdersV4ActivityReport(companyId, type, startDate, endDate, filters),
    fallbackMessage: 'تعذر تحميل تقرير حركات طلبات V4',
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

export function useOrdersV4Summary(companyId: string, startDate: string, endDate: string, enabled = true) {
  return useApiQuery<OrdersV4Summary>({
    queryKey: [...ordersV4Keys.reports(companyId), 'summary', startDate, endDate],
    queryFn: () => getOrdersV4Summary(companyId, startDate, endDate),
    fallbackMessage: 'تعذر تحميل ملخص طلبات V4',
    enabled: enabled && !!companyId && !!startDate && !!endDate,
  });
}

export function useOrdersV4ItemsReport(companyId: string, type: 'purchase' | 'registration' | '', startDate: string, endDate: string) {
  return useApiListQuery<OrdersV4ItemsReportRow>({
    queryKey: [...ordersV4Keys.reports(companyId), 'items', type, startDate, endDate],
    queryFn: () => getOrdersV4ItemsReport(companyId, type, startDate, endDate),
    fallbackMessage: 'تعذر تحميل تقرير أصناف V4',
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

export function useOrdersV4SalesReport(companyId: string, startDate: string, endDate: string, filters: OrdersV4ReportFilters = {}) {
  return useApiQuery<OrdersV4SalesReport>({
    queryKey: [...ordersV4Keys.reports(companyId), 'sales', startDate, endDate, filters],
    queryFn: () => getOrdersV4SalesReport(companyId, startDate, endDate, filters),
    fallbackMessage: 'تعذر تحميل تقرير التسجيل الداخلي V4',
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

export function useOrdersV4Balances(companyId: string) {
  return useApiListQuery<OrdersV4InventoryBalance>({
    queryKey: [...ordersV4Keys.inventory(companyId), 'balances'],
    queryFn: () => getOrdersV4Balances(companyId),
    fallbackMessage: 'تعذر تحميل أرصدة V4',
    enabled: !!companyId,
  });
}

export function useOrdersV4Ledger(companyId: string, enabled = true, limit = 250) {
  return useApiListQuery<OrdersV4LedgerEntry>({
    queryKey: [...ordersV4Keys.inventory(companyId), 'ledger', limit],
    queryFn: () => getOrdersV4Ledger(companyId, limit),
    fallbackMessage: 'تعذر تحميل دفتر V4',
    enabled: enabled && !!companyId,
  });
}

export function useOrdersV4Stocktakes(companyId: string, enabled = true, limit = 100) {
  return useApiListQuery<OrdersV4Stocktake>({
    queryKey: [...ordersV4Keys.inventory(companyId), 'stocktakes', limit],
    queryFn: () => getOrdersV4Stocktakes(companyId, limit),
    fallbackMessage: 'تعذر تحميل سجل الجرد V4',
    enabled: enabled && !!companyId,
  });
}

export function useOrdersV4DataQuality(companyId: string, enabled = true) {
  return useApiQuery<OrdersV4DataQuality>({
    queryKey: [...ordersV4Keys.inventory(companyId), 'quality'],
    queryFn: () => getOrdersV4DataQuality(companyId),
    fallbackMessage: 'تعذر تحميل جودة بيانات V4',
    enabled: enabled && !!companyId,
  });
}

export function useCreateOrdersV4Document(companyId: string) {
  return useApiMutation({
    mutationFn: (body: OrdersV4DocumentPayload) => createOrdersV4Document(companyId, body),
    invalidateQueries: [ordersV4Keys.documentsRoot(companyId), ordersV4Keys.reports(companyId), ordersV4Keys.inventory(companyId)],
    successToast: 'تم اعتماد مستند V4 وحساب حركاته مركزياً',
    showErrorToast: true,
  });
}

export function usePreviewOrdersV4Document(companyId: string) {
  return useApiMutation({
    mutationFn: (body: OrdersV4DocumentPreviewPayload) => previewOrdersV4Document(companyId, body),
    showErrorToast: false,
  });
}

export function useReverseOrdersV4Document(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) => reverseOrdersV4Document(companyId, id, idempotencyKey),
    invalidateQueries: [ordersV4Keys.documentsRoot(companyId), ordersV4Keys.reports(companyId), ordersV4Keys.inventory(companyId), ordersV4Keys.bootstrap(companyId)],
    successToast: 'تم إلغاء المستند مع حفظ سجل المراجعة',
    showErrorToast: true,
  });
}

export function useUndoReverseOrdersV4Document(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) => undoReverseOrdersV4Document(companyId, id, idempotencyKey),
    invalidateQueries: [ordersV4Keys.documentsRoot(companyId), ordersV4Keys.reports(companyId), ordersV4Keys.inventory(companyId), ordersV4Keys.bootstrap(companyId)],
    successToast: 'تمت استعادة المستند وإعادة تطبيق أثره الدفتري',
    showErrorToast: true,
  });
}

export function useReopenOrdersV4Document(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, idempotencyKey, reopenMode }: { id: string; idempotencyKey: string; reopenMode?: 'edit' | 'delegate' }) => reopenOrdersV4Document(companyId, id, idempotencyKey, reopenMode),
    invalidateQueries: [ordersV4Keys.documentsRoot(companyId), ordersV4Keys.reports(companyId), ordersV4Keys.inventory(companyId), ordersV4Keys.bootstrap(companyId)],
    successToast: 'تم فتح الطلب للتعديل',
    showErrorToast: true,
  });
}

export function useReceiveOrdersV4Document(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, body }: { id: string; body: OrdersV4ReceivePayload }) => receiveOrdersV4Document(companyId, id, body),
    invalidateQueries: [ordersV4Keys.documentsRoot(companyId), ordersV4Keys.reports(companyId), ordersV4Keys.inventory(companyId), ordersV4Keys.bootstrap(companyId)],
    successToast: 'تم حفظ الطلب وترحيل المخزون والأسعار وطريقة الدفع',
    showErrorToast: true,
  });
}

export function useCreateOrdersV4Stocktake(companyId: string) {
  return useApiMutation({
    mutationFn: (body: { stocktakeDate: string; locationId: string; notes?: string; idempotencyKey: string; lines: Array<{ itemId: string; physicalUnits: Array<{ unitId: string; quantity: string }> }> }) => createOrdersV4Stocktake(companyId, body),
    invalidateQueries: [ordersV4Keys.inventory(companyId), ordersV4Keys.reports(companyId)],
    successToast: 'تم اعتماد جرد V4 وتسجيل فروق الدفتر',
  });
}

export function useOrdersV4CatalogMutations(companyId: string) {
  const invalidateQueries = [ordersV4Keys.bootstrap(companyId), ordersV4Keys.inventory(companyId)];
  return {
    createUnit: useApiMutation({ mutationFn: (body: { code: string; nameAr: string; nameEn?: string; dimension: string; canonicalFactor?: string | null }) => createOrdersV4Unit(companyId, body), invalidateQueries, showErrorToast: true }),
    createCategory: useApiMutation({ mutationFn: (body: { nameAr: string; nameEn?: string }) => createOrdersV4Category(companyId, body), invalidateQueries, showErrorToast: true }),
    updateCategory: useApiMutation({ mutationFn: ({ id, body }: { id: string; body: { nameAr: string; nameEn?: string } }) => updateOrdersV4Category(companyId, id, body), invalidateQueries, successToast: 'تم تحديث الفئة', showErrorToast: true }),
    createSection: useApiMutation({ mutationFn: (body: { code?: string; nameAr: string; nameEn?: string }) => createOrdersV4Section(companyId, body), invalidateQueries, showErrorToast: true }),
    updateSection: useApiMutation({ mutationFn: ({ id, body }: { id: string; body: { code?: string; nameAr: string; nameEn?: string } }) => updateOrdersV4Section(companyId, id, body), invalidateQueries, successToast: 'تم تحديث القسم', showErrorToast: true }),
    createLocation: useApiMutation({ mutationFn: (body: { code?: string; nameAr: string; nameEn?: string; kind?: string; sectionId?: string | null }) => createOrdersV4Location(companyId, body), invalidateQueries, showErrorToast: true }),
    createItem: useApiMutation({ mutationFn: (body: { sku?: string; nameAr: string; nameEn?: string; itemType: 'purchased' | 'sale'; categoryId?: string | null; inventoryUnitId: string; sectionIds?: string[]; trackInventory?: boolean; units?: Array<{ unitId: string; purchaseLabel?: string | null; isOrderEnabled?: boolean; lastPrice?: string | null; salePrice?: string | null }> }) => createOrdersV4Item(companyId, body), invalidateQueries, showErrorToast: true }),
    updateItem: useApiMutation({ mutationFn: ({ id, body }: { id: string; body: { sku?: string | null; nameAr: string; nameEn?: string; categoryId?: string | null; sectionIds?: string[]; trackInventory?: boolean } }) => updateOrdersV4Item(companyId, id, body), invalidateQueries, successToast: 'تم تحديث بيانات الصنف', showErrorToast: true }),
    saveItemDefinition: useApiMutation({ mutationFn: ({ id, body }: { id: string; body: { inventoryUnitId: string; edges: Array<{ fromUnitId: string; toUnitId: string; factor: string; reversible?: boolean; allowDimensionBridge?: boolean }>; units: Array<{ unitId: string; purchaseLabel?: string | null; isOrderEnabled?: boolean; lastPrice?: string | null; salePrice?: string | null; sortOrder?: number }> } }) => saveOrdersV4ItemDefinition(companyId, id, body), invalidateQueries, successToast: 'تم حفظ سلسلة الوحدات والأسعار', showErrorToast: true }),
    publishRecipe: useApiMutation({ mutationFn: (body: { outputItemId: string; outputQuantity: string; outputUnitId: string; lines: Array<{ componentItemId: string; quantity: string; unitId: string }> }) => publishOrdersV4Recipe(companyId, body), invalidateQueries, showErrorToast: true }),
    deactivate: useApiMutation({ mutationFn: ({ entity, id }: { entity: string; id: string }) => deactivateOrdersV4Catalog(companyId, entity, id), invalidateQueries, showErrorToast: true }),
    restoreUnit: useApiMutation({ mutationFn: (id: string) => restoreOrdersV4Unit(companyId, id), invalidateQueries, successToast: 'تم استرجاع الوحدة', showErrorToast: true }),
  };
}
