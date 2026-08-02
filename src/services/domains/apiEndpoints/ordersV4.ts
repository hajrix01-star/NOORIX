import type {
  ApiParsedResult,
  OrdersV4Bootstrap,
  OrdersV4Category,
  OrdersV4DataQuality,
  OrdersV4CutoverAudit,
  OrdersV4CutoverResult,
  OrdersV4Document,
  OrdersV4DocumentPayload,
  OrdersV4ReceivePayload,
  OrdersV4InventoryBalance,
  OrdersV4Item,
  OrdersV4ItemsReportRow,
  OrdersV4LedgerEntry,
  OrdersV4Location,
  OrdersV4RecipeVersion,
  OrdersV4SalesReport,
  OrdersV4Section,
  OrdersV4Stocktake,
  OrdersV4Summary,
  OrdersV4Unit,
} from '../../../types/api';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../core/apiHttp';

const BASE = '/api/v1/orders-v4';

export function getOrdersV4Bootstrap(companyId: string): Promise<ApiParsedResult<OrdersV4Bootstrap>> {
  return apiGet(`${BASE}/bootstrap`, { companyId });
}

export function getOrdersV4Documents(companyId: string, type: 'purchase' | 'registration', startDate: string, endDate: string): Promise<ApiParsedResult<OrdersV4Document[]>> {
  return apiGet(`${BASE}/documents`, { companyId, type, startDate, endDate });
}

export function createOrdersV4Document(companyId: string, body: OrdersV4DocumentPayload): Promise<ApiParsedResult<OrdersV4Document>> {
  return apiPost(`${BASE}/documents?companyId=${encodeURIComponent(companyId)}`, body);
}

export function receiveOrdersV4Document(companyId: string, id: string, body: OrdersV4ReceivePayload): Promise<ApiParsedResult<OrdersV4Document>> {
  return apiPatch(`${BASE}/documents/${encodeURIComponent(id)}/receive?companyId=${encodeURIComponent(companyId)}`, body);
}

export function reverseOrdersV4Document(companyId: string, id: string, idempotencyKey: string): Promise<ApiParsedResult<OrdersV4Document>> {
  return apiPost(`${BASE}/documents/${encodeURIComponent(id)}/reverse?companyId=${encodeURIComponent(companyId)}`, { idempotencyKey });
}

export function undoReverseOrdersV4Document(companyId: string, id: string, idempotencyKey: string): Promise<ApiParsedResult<OrdersV4Document>> {
  return apiPost(`${BASE}/documents/${encodeURIComponent(id)}/undo-reverse?companyId=${encodeURIComponent(companyId)}`, { idempotencyKey });
}

export function getOrdersV4Summary(companyId: string, startDate: string, endDate: string): Promise<ApiParsedResult<OrdersV4Summary>> {
  return apiGet(`${BASE}/reports/summary`, { companyId, startDate, endDate });
}

export function getOrdersV4ItemsReport(companyId: string, type: 'purchase' | 'registration' | '', startDate: string, endDate: string): Promise<ApiParsedResult<OrdersV4ItemsReportRow[]>> {
  return apiGet(`${BASE}/reports/items`, { companyId, type, startDate, endDate });
}

export function getOrdersV4SalesReport(companyId: string, startDate: string, endDate: string): Promise<ApiParsedResult<OrdersV4SalesReport>> {
  return apiGet(`${BASE}/reports/sales`, { companyId, startDate, endDate });
}

export function getOrdersV4Balances(companyId: string): Promise<ApiParsedResult<OrdersV4InventoryBalance[]>> {
  return apiGet(`${BASE}/inventory/balances`, { companyId });
}

export function getOrdersV4Ledger(companyId: string): Promise<ApiParsedResult<OrdersV4LedgerEntry[]>> {
  return apiGet(`${BASE}/inventory/ledger`, { companyId });
}

export function getOrdersV4Stocktakes(companyId: string): Promise<ApiParsedResult<OrdersV4Stocktake[]>> {
  return apiGet(`${BASE}/inventory/stocktakes`, { companyId });
}

export function createOrdersV4Stocktake(companyId: string, body: {
  stocktakeDate: string; locationId: string; notes?: string; idempotencyKey: string;
  lines: Array<{ itemId: string; physicalQuantity: string }>;
}): Promise<ApiParsedResult<OrdersV4Stocktake>> {
  return apiPost(`${BASE}/inventory/stocktakes?companyId=${encodeURIComponent(companyId)}`, body);
}

export function getOrdersV4DataQuality(companyId: string): Promise<ApiParsedResult<OrdersV4DataQuality>> {
  return apiGet(`${BASE}/inventory/data-quality`, { companyId });
}

export function getOrdersV4CutoverAudit(companyId: string): Promise<ApiParsedResult<OrdersV4CutoverAudit>> {
  return apiGet(`${BASE}/cutover/audit`, { companyId });
}

export function executeOrdersV4Cutover(companyId: string, body: { confirmation: string; sourceFingerprint: string }): Promise<ApiParsedResult<OrdersV4CutoverResult>> {
  return apiPost(`${BASE}/cutover/execute?companyId=${encodeURIComponent(companyId)}`, body);
}

export function createOrdersV4Unit(companyId: string, body: { code: string; nameAr: string; nameEn?: string; dimension: string; canonicalFactor?: string | null }): Promise<ApiParsedResult<OrdersV4Unit>> {
  return apiPost(`${BASE}/catalog/units?companyId=${encodeURIComponent(companyId)}`, body);
}

export function createOrdersV4Category(companyId: string, body: { nameAr: string; nameEn?: string }): Promise<ApiParsedResult<OrdersV4Category>> {
  return apiPost(`${BASE}/catalog/categories?companyId=${encodeURIComponent(companyId)}`, body);
}

export function updateOrdersV4Category(companyId: string, id: string, body: { nameAr: string; nameEn?: string }): Promise<ApiParsedResult<OrdersV4Category>> {
  return apiPatch(`${BASE}/catalog/categories/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`, body);
}

export function createOrdersV4Section(companyId: string, body: { code?: string; nameAr: string; nameEn?: string }): Promise<ApiParsedResult<OrdersV4Section>> {
  return apiPost(`${BASE}/catalog/sections?companyId=${encodeURIComponent(companyId)}`, body);
}

export function updateOrdersV4Section(companyId: string, id: string, body: { code?: string; nameAr: string; nameEn?: string }): Promise<ApiParsedResult<OrdersV4Section>> {
  return apiPatch(`${BASE}/catalog/sections/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`, body);
}

export function createOrdersV4Location(companyId: string, body: { code?: string; nameAr: string; nameEn?: string; kind?: string; sectionId?: string | null }): Promise<ApiParsedResult<OrdersV4Location>> {
  return apiPost(`${BASE}/catalog/locations?companyId=${encodeURIComponent(companyId)}`, body);
}

export function createOrdersV4Item(companyId: string, body: {
  sku?: string; nameAr: string; nameEn?: string; itemType: 'purchased' | 'sale';
  categoryId?: string | null; inventoryUnitId: string; sectionIds?: string[]; trackInventory?: boolean;
  units?: Array<{ unitId: string; purchaseLabel?: string | null; isOrderEnabled?: boolean; lastPrice?: string | null; sortOrder?: number }>;
}): Promise<ApiParsedResult<OrdersV4Item>> {
  return apiPost(`${BASE}/catalog/items?companyId=${encodeURIComponent(companyId)}`, body);
}

export function updateOrdersV4Item(companyId: string, id: string, body: {
  sku?: string | null; nameAr: string; nameEn?: string; categoryId?: string | null;
  sectionIds?: string[]; trackInventory?: boolean; sortOrder?: number;
}): Promise<ApiParsedResult<OrdersV4Item>> {
  return apiPatch(`${BASE}/catalog/items/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`, body);
}

export function saveOrdersV4ItemDefinition(companyId: string, id: string, body: {
  inventoryUnitId: string;
  edges: Array<{ fromUnitId: string; toUnitId: string; factor: string; reversible?: boolean; allowDimensionBridge?: boolean }>;
  units: Array<{ unitId: string; purchaseLabel?: string | null; isOrderEnabled?: boolean; lastPrice?: string | null; sortOrder?: number }>;
}): Promise<ApiParsedResult<{ item: OrdersV4Item; conversionVersionId: string }>> {
  return apiPatch(`${BASE}/catalog/items/${encodeURIComponent(id)}/definition?companyId=${encodeURIComponent(companyId)}`, body);
}

export function publishOrdersV4Recipe(companyId: string, body: {
  outputItemId: string; outputQuantity: string; outputUnitId: string;
  lines: Array<{ componentItemId: string; quantity: string; unitId: string }>;
}): Promise<ApiParsedResult<OrdersV4RecipeVersion>> {
  return apiPost(`${BASE}/catalog/recipes/publish?companyId=${encodeURIComponent(companyId)}`, body);
}

export function deactivateOrdersV4Catalog(companyId: string, entity: string, id: string): Promise<ApiParsedResult<{ id: string; deactivated: boolean }>> {
  return apiDelete(`${BASE}/catalog/${encodeURIComponent(entity)}/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`);
}

export function restoreOrdersV4Unit(companyId: string, id: string): Promise<ApiParsedResult<{ id: string; restored: boolean }>> {
  return apiPatch(`${BASE}/catalog/units/${encodeURIComponent(id)}/restore?companyId=${encodeURIComponent(companyId)}`, {});
}
