import type {
  ApiParsedResult,
  ApplyOrderProductTranslationItem,
  ApplyOrderProductTranslationsResult,
  CreateInventoryStocktakePayload,
  CreateOrderPayload,
  OrderCatalogBatchCreateResult,
  OrderCatalogUnit,
  OrderCatalogUnitPayload,
  OrderCategory,
  OrderCategoryPayload,
  OrderConversionTemplate,
  OrderConversionTemplatePayload,
  OrderItemsReportRow,
  OrderItemsReportResult,
  InventoryStocktake,
  OrderProduct,
  OrderProductPayload,
  OrderProductTranslationPreview,
  OrderProductType,
  OrderPurchaseHistoryRow,
  OrderRangeSummary,
  OrderRecipeInventoryStockRow,
  OrderRecord,
  OrderSection,
  OrderSectionPayload,
  OrderSummary,
  StaffOrder,
  StaffOrderPayload,
  StaffSaleDateStatus,
  StaffSaleNextLogRef,
  StaffSaleReport,
  UpdateOrderPayload,
} from '../../../types/api';
import { toYmd } from '../../../utils/saudiDate';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

export async function getOrders(
  companyId: string,
  year: string | number,
  month: string | number,
): Promise<ApiParsedResult<OrderRecord[]>> {
  const res = await apiGet<OrderRecord[]>('/api/v1/orders', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function createOrder(body: CreateOrderPayload): Promise<ApiParsedResult<OrderRecord>> {
  return apiPost<OrderRecord>('/api/v1/orders', body);
}
export async function updateOrder(id: string, body: UpdateOrderPayload, companyId: string): Promise<ApiParsedResult<OrderRecord>> {
  return apiPatch<OrderRecord>(`/api/v1/orders/${id}?companyId=${companyId}`, body);
}
export async function cancelOrder(id: string, companyId: string): Promise<ApiParsedResult<{ success: boolean }>> {
  return apiDelete(`/api/v1/orders/${id}?companyId=${companyId}`);
}
export async function getOrdersSummary(
  companyId: string,
  year: string | number,
  month: string | number,
): Promise<ApiParsedResult<OrderSummary>> {
  const res = await apiGet<OrderSummary>('/api/v1/orders/summary', { companyId, year: String(year), month: String(month) });
  const empty: OrderSummary = {
    pettyCashTotal: 0,
    delegatePurchasesTotal: 0,
    localPurchasesTotal: 0,
    transferPurchasesTotal: 0,
    delegateBalance: 0,
  };
  return res?.success ? { ...res, data: res.data ?? empty } : res;
}
export async function getOrdersRangeSummary(
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<ApiParsedResult<OrderRangeSummary>> {
  const res = await apiGet<OrderRangeSummary>('/api/v1/orders/range-summary', { companyId, startDate, endDate });
  const empty: OrderRangeSummary = {
    pettyCashTotal: 0,
    delegatePurchasesTotal: 0,
    localPurchasesTotal: 0,
    transferPurchasesTotal: 0,
    delegateBalance: 0,
    cashSalesTotal: 0,
    cashRemaining: 0,
    filteredTotal: 0,
  };
  return res?.success ? { ...res, data: res.data ?? empty } : res;
}
export async function getProductPurchaseHistory(
  companyId: string,
  productId: string,
  year: string | number | null | undefined,
  month: string | number | null | undefined,
  startDate?: string,
  endDate?: string,
): Promise<ApiParsedResult<OrderPurchaseHistoryRow[]>> {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (year != null && year !== '') params.year = String(year);
  if (month != null && month !== '') params.month = String(month);
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  const res = await apiGet<OrderPurchaseHistoryRow[]>(`/api/v1/orders/product-history/${productId}`, params);
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function getCategoryPurchaseHistory(
  companyId: string,
  categoryId: string,
  year: string | number | null | undefined,
  month: string | number | null | undefined,
  startDate?: string,
  endDate?: string,
): Promise<ApiParsedResult<OrderPurchaseHistoryRow[]>> {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (year != null && year !== '') params.year = String(year);
  if (month != null && month !== '') params.month = String(month);
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  const res = await apiGet<OrderPurchaseHistoryRow[]>(`/api/v1/orders/category-history/${categoryId}`, params);
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function getOrdersItemsReport(
  companyId: string,
  year: string | number,
  month: string | number,
): Promise<ApiParsedResult<OrderItemsReportRow[]>> {
  const res = await apiGet<OrderItemsReportRow[]>('/api/v1/orders/items-report', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function getOrdersItemsReportRange(
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<ApiParsedResult<OrderItemsReportResult>> {
  const res = await apiGet<OrderItemsReportResult>('/api/v1/orders/items-report-range', {
    companyId,
    startDate,
    endDate,
  });
  return res;
}
export async function getOrdersRecipeInventoryStock(
  companyId: string,
): Promise<ApiParsedResult<OrderRecipeInventoryStockRow[]>> {
  const res = await apiGet<OrderRecipeInventoryStockRow[]>('/api/v1/orders/recipe-inventory-stock', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function getInventoryStocktakes(
  companyId: string,
): Promise<ApiParsedResult<InventoryStocktake[]>> {
  const res = await apiGet<InventoryStocktake[]>('/api/v1/orders/inventory-stocktakes', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function createInventoryStocktake(
  body: CreateInventoryStocktakePayload,
): Promise<ApiParsedResult<InventoryStocktake>> {
  return apiPost<InventoryStocktake>('/api/v1/orders/inventory-stocktakes', body);
}
export async function getOrderProducts(companyId: string, section?: string, type?: string): Promise<ApiParsedResult<OrderProduct[]>> {
  const params: Record<string, string> = { companyId };
  if (section) params.section = section;
  if (type) params.type = type;
  const res = await apiGet<OrderProduct[]>('/api/v1/orders/products', params);
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function previewOrderProductTranslations(
  companyId: string,
  productType: OrderProductType,
): Promise<ApiParsedResult<OrderProductTranslationPreview>> {
  return apiPost<OrderProductTranslationPreview>(
    `/api/v1/orders/products/translation-preview?companyId=${encodeURIComponent(companyId)}`,
    { productType, limit: 50 },
    { timeout: 90_000 },
  );
}
export async function applyOrderProductTranslations(
  companyId: string,
  translations: ApplyOrderProductTranslationItem[],
): Promise<ApiParsedResult<ApplyOrderProductTranslationsResult>> {
  return apiPost<ApplyOrderProductTranslationsResult>(
    `/api/v1/orders/products/translation-apply?companyId=${encodeURIComponent(companyId)}`,
    { translations },
  );
}
export async function createOrderProduct(body: OrderProductPayload & { companyId: string }): Promise<ApiParsedResult<OrderProduct>> {
  return apiPost<OrderProduct>('/api/v1/orders/products', body);
}
export async function createOrderProductsBatch(
  companyId: string,
  products: OrderProductPayload[],
): Promise<ApiParsedResult<OrderCatalogBatchCreateResult>> {
  return apiPost<OrderCatalogBatchCreateResult>('/api/v1/orders/products/batch', { companyId, products }, { timeout: 90000 });
}
export async function createOrderCategoriesBatch(
  companyId: string,
  categories: OrderCategoryPayload[],
): Promise<ApiParsedResult<OrderCatalogBatchCreateResult>> {
  return apiPost<OrderCatalogBatchCreateResult>('/api/v1/orders/categories/batch', { companyId, categories }, { timeout: 60000 });
}
export async function updateOrderProduct(
  id: string,
  body: Partial<OrderProductPayload>,
  companyId: string,
): Promise<ApiParsedResult<OrderProduct>> {
  return apiPatch<OrderProduct>(`/api/v1/orders/products/${id}?companyId=${companyId}`, body);
}

export async function getOrderCatalogUnits(companyId: string): Promise<ApiParsedResult<OrderCatalogUnit[]>> {
  const res = await apiGet<OrderCatalogUnit[]>('/api/v1/orders/catalog-units', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}

export async function createOrderCatalogUnit(
  body: OrderCatalogUnitPayload & { companyId: string },
): Promise<ApiParsedResult<OrderCatalogUnit>> {
  const { companyId, ...payload } = body;
  return apiPost<OrderCatalogUnit>(`/api/v1/orders/catalog-units?companyId=${encodeURIComponent(companyId)}`, payload);
}

export async function updateOrderCatalogUnit(
  id: string,
  body: Partial<OrderCatalogUnitPayload>,
  companyId: string,
): Promise<ApiParsedResult<OrderCatalogUnit>> {
  return apiPatch<OrderCatalogUnit>(`/api/v1/orders/catalog-units/${id}?companyId=${companyId}`, body);
}

export async function deleteOrderCatalogUnit(
  id: string,
  companyId: string,
): Promise<ApiParsedResult<OrderCatalogUnit>> {
  return apiDelete<OrderCatalogUnit>(`/api/v1/orders/catalog-units/${id}?companyId=${companyId}`);
}

export async function getOrderConversionTemplates(companyId: string): Promise<ApiParsedResult<OrderConversionTemplate[]>> {
  const res = await apiGet<OrderConversionTemplate[]>('/api/v1/orders/conversion-templates', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}

export async function createOrderConversionTemplate(
  body: OrderConversionTemplatePayload & { companyId: string },
): Promise<ApiParsedResult<OrderConversionTemplate>> {
  const { companyId, ...payload } = body;
  return apiPost<OrderConversionTemplate>(`/api/v1/orders/conversion-templates?companyId=${encodeURIComponent(companyId)}`, payload);
}

export async function updateOrderConversionTemplate(
  id: string,
  body: Partial<OrderConversionTemplatePayload>,
  companyId: string,
): Promise<ApiParsedResult<OrderConversionTemplate>> {
  return apiPatch<OrderConversionTemplate>(`/api/v1/orders/conversion-templates/${id}?companyId=${companyId}`, body);
}

export async function deleteOrderConversionTemplate(
  id: string,
  companyId: string,
): Promise<ApiParsedResult<OrderConversionTemplate>> {
  return apiDelete<OrderConversionTemplate>(`/api/v1/orders/conversion-templates/${id}?companyId=${companyId}`);
}

export async function getOrderCategories(companyId: string): Promise<ApiParsedResult<OrderCategory[]>> {
  const res = await apiGet<OrderCategory[]>('/api/v1/orders/categories', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function createOrderCategory(body: OrderCategoryPayload & { companyId: string }): Promise<ApiParsedResult<OrderCategory>> {
  return apiPost<OrderCategory>('/api/v1/orders/categories', body);
}
export async function updateOrderCategory(
  id: string,
  body: Partial<OrderCategoryPayload>,
  companyId: string,
): Promise<ApiParsedResult<OrderCategory>> {
  return apiPatch<OrderCategory>(`/api/v1/orders/categories/${id}?companyId=${companyId}`, body);
}
export async function deactivateOrderProductsBulk(
  companyId: string,
  ids: string[],
): Promise<ApiParsedResult<{ deleted: number }>> {
  const results = await Promise.all(
    ids.map((id) => apiPatch(`/api/v1/orders/products/${id}?companyId=${companyId}`, { isActive: false })),
  );
  return { success: true, data: { deleted: results.filter((r) => r?.success).length } };
}
export async function deactivateOrderCategoriesBulk(
  companyId: string,
  ids: string[],
): Promise<ApiParsedResult<{ deleted: number }>> {
  const results = await Promise.all(
    ids.map((id) => apiPatch(`/api/v1/orders/categories/${id}?companyId=${companyId}`, { isActive: false })),
  );
  return { success: true, data: { deleted: results.filter((r) => r?.success).length } };
}

// ——— طلبات الأقسام (Staff Orders) ———

export async function getMyStaffOrders(companyId: string): Promise<ApiParsedResult<StaffOrder[]>> {
  const res = await apiGet<StaffOrder[]>('/api/v1/orders/staff/my', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}

export async function getStaffSaleNextLogRef(
  companyId: string,
  saleDate: string,
): Promise<ApiParsedResult<StaffSaleNextLogRef>> {
  const res = await apiGet<StaffSaleNextLogRef>('/api/v1/orders/staff/sale-next-ref', { companyId, saleDate });
  return res?.success ? { ...res, data: res.data ?? { logRef: '' } } : res;
}

export async function getStaffSaleDateStatus(
  companyId: string,
  sectionName: string,
): Promise<ApiParsedResult<StaffSaleDateStatus>> {
  return apiGet<StaffSaleDateStatus>('/api/v1/orders/staff/sale-date-status', {
    companyId,
    sectionName,
  });
}

export async function createStaffOrder(body: StaffOrderPayload): Promise<ApiParsedResult<StaffOrder | { orders: StaffOrder[]; count: number; logRef?: string | null; whatsAppText?: string }>> {
  const companyId = body.companyId;
  const q = companyId ? `?companyId=${encodeURIComponent(String(companyId))}` : '';
  return apiPost(`/api/v1/orders/staff${q}`, body);
}

export async function updateStaffOrder(id: string, companyId: string, body: Partial<StaffOrderPayload>): Promise<ApiParsedResult<StaffOrder & { whatsAppText?: string }>> {
  return apiPatch<StaffOrder & { whatsAppText?: string }>(`/api/v1/orders/staff/${id}?companyId=${companyId}`, body);
}

export async function deleteStaffOrder(id: string, companyId: string): Promise<ApiParsedResult<{ deleted: boolean }>> {
  return apiDelete(`/api/v1/orders/staff/${id}?companyId=${companyId}`);
}

export async function resendStaffOrder(
  id: string,
  companyId: string,
  lang?: 'ar' | 'en',
): Promise<ApiParsedResult<{ whatsAppText?: string; logRef?: string | null }>> {
  return apiPost<{ whatsAppText?: string; logRef?: string | null }>(`/api/v1/orders/staff/${id}/resend?companyId=${companyId}`, { lang });
}

export async function getSalesReport(
  companyId: string,
  period: number | { startDate: string; endDate: string } = 30,
): Promise<ApiParsedResult<StaffSaleReport>> {
  const params = typeof period === 'number'
    ? { companyId, days: String(period) }
    : { companyId, startDate: toYmd(period.startDate), endDate: toYmd(period.endDate) };
  const res = await apiGet<StaffSaleReport>('/api/v1/orders/sales/report', params);
  const empty = emptyStaffSaleReport();
  return res?.success ? { ...res, data: res.data ?? empty } : res;
}

function emptyStaffSaleReport(): StaffSaleReport {
  return {
    summary: { totalOrders: 0, totalQty: 0, totalAmount: 0, avgPerOrder: 0, uniqueProducts: 0, uniqueSections: 0 },
    byProduct: [],
    bySection: [],
    byUser: [],
    byDay: [],
    byLog: [],
    registrationCoverage: {
      startDate: '',
      endDate: '',
      expectedSectionDays: 0,
      registeredSectionDays: 0,
      missingSectionDays: 0,
      affectedSections: 0,
      sections: [],
      missingDays: [],
    },
  };
}

// ── Sections ──────────────────────────────────────────────────────
export async function getOrderSections(companyId: string): Promise<ApiParsedResult<OrderSection[]>> {
  const res = await apiGet<OrderSection[]>('/api/v1/orders/sections', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function createOrderSection(body: OrderSectionPayload & { companyId: string }): Promise<ApiParsedResult<OrderSection>> {
  return apiPost<OrderSection>('/api/v1/orders/sections', body);
}
export async function updateOrderSection(
  id: string,
  body: Partial<OrderSectionPayload>,
  companyId: string,
): Promise<ApiParsedResult<OrderSection>> {
  return apiPatch<OrderSection>(`/api/v1/orders/sections/${id}?companyId=${companyId}`, body);
}
export async function deleteOrderSection(id: string, companyId: string): Promise<ApiParsedResult<{ deleted: boolean }>> {
  return apiDelete(`/api/v1/orders/sections/${id}?companyId=${companyId}`);
}
export async function bulkSetProductSections(
  companyId: string,
  productIds: string[],
  opts: { sectionNames?: string[]; sectionIds?: string[]; mode?: 'replace' | 'add' },
): Promise<ApiParsedResult<{ updated: number }>> {
  return apiPost<{ updated: number }>(`/api/v1/orders/products/bulk-sections?companyId=${companyId}`, {
    productIds,
    sectionNames: opts.sectionNames,
    sectionIds: opts.sectionIds,
    mode: opts.mode,
  });
}
