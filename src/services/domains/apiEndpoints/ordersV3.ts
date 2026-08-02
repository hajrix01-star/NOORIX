import type {
  ApiParsedResult,
  OrdersV3Bootstrap,
  OrdersV3Category,
  OrdersV3ConversionVersion,
  OrdersV3DataQuality,
  OrdersV3Document,
  OrdersV3DocumentPayload,
  OrdersV3InventoryBalance,
  OrdersV3Item,
  OrdersV3ItemsReportRow,
  OrdersV3LedgerEntry,
  OrdersV3Location,
  OrdersV3RecipeVersion,
  OrdersV3SalesReport,
  OrdersV3Section,
  OrdersV3Stocktake,
  OrdersV3Summary,
  OrdersV3Unit,
} from '../../../types/api';
import { apiDelete, apiGet, apiPost } from '../../core/apiHttp';

const BASE = '/api/v1/orders-v3';

export function getOrdersV3Bootstrap(companyId: string): Promise<ApiParsedResult<OrdersV3Bootstrap>> {
  return apiGet(`${BASE}/bootstrap`, { companyId });
}

export function getOrdersV3Documents(companyId: string, type: 'purchase' | 'registration', startDate: string, endDate: string): Promise<ApiParsedResult<OrdersV3Document[]>> {
  return apiGet(`${BASE}/documents`, { companyId, type, startDate, endDate });
}

export function createOrdersV3Document(companyId: string, body: OrdersV3DocumentPayload): Promise<ApiParsedResult<OrdersV3Document>> {
  return apiPost(`${BASE}/documents?companyId=${encodeURIComponent(companyId)}`, body);
}

export function reverseOrdersV3Document(companyId: string, id: string, idempotencyKey: string): Promise<ApiParsedResult<OrdersV3Document>> {
  return apiPost(`${BASE}/documents/${encodeURIComponent(id)}/reverse?companyId=${encodeURIComponent(companyId)}`, { idempotencyKey });
}

export function getOrdersV3Summary(companyId: string, startDate: string, endDate: string): Promise<ApiParsedResult<OrdersV3Summary>> {
  return apiGet(`${BASE}/reports/summary`, { companyId, startDate, endDate });
}

export function getOrdersV3ItemsReport(companyId: string, type: 'purchase' | 'registration' | '', startDate: string, endDate: string): Promise<ApiParsedResult<OrdersV3ItemsReportRow[]>> {
  return apiGet(`${BASE}/reports/items`, { companyId, type, startDate, endDate });
}

export function getOrdersV3SalesReport(companyId: string, startDate: string, endDate: string): Promise<ApiParsedResult<OrdersV3SalesReport>> {
  return apiGet(`${BASE}/reports/sales`, { companyId, startDate, endDate });
}

export function getOrdersV3Balances(companyId: string): Promise<ApiParsedResult<OrdersV3InventoryBalance[]>> {
  return apiGet(`${BASE}/inventory/balances`, { companyId });
}

export function getOrdersV3Ledger(companyId: string): Promise<ApiParsedResult<OrdersV3LedgerEntry[]>> {
  return apiGet(`${BASE}/inventory/ledger`, { companyId });
}

export function getOrdersV3Stocktakes(companyId: string): Promise<ApiParsedResult<OrdersV3Stocktake[]>> {
  return apiGet(`${BASE}/inventory/stocktakes`, { companyId });
}

export function createOrdersV3Stocktake(companyId: string, body: {
  stocktakeDate: string; locationId: string; notes?: string; idempotencyKey: string;
  lines: Array<{ itemId: string; physicalQuantity: string }>;
}): Promise<ApiParsedResult<OrdersV3Stocktake>> {
  return apiPost(`${BASE}/inventory/stocktakes?companyId=${encodeURIComponent(companyId)}`, body);
}

export function getOrdersV3DataQuality(companyId: string): Promise<ApiParsedResult<OrdersV3DataQuality>> {
  return apiGet(`${BASE}/inventory/data-quality`, { companyId });
}

export function createOrdersV3Unit(companyId: string, body: { code: string; nameAr: string; nameEn?: string; dimension: string; canonicalFactor?: string | null }): Promise<ApiParsedResult<OrdersV3Unit>> {
  return apiPost(`${BASE}/catalog/units?companyId=${encodeURIComponent(companyId)}`, body);
}

export function createOrdersV3Category(companyId: string, body: { nameAr: string; nameEn?: string }): Promise<ApiParsedResult<OrdersV3Category>> {
  return apiPost(`${BASE}/catalog/categories?companyId=${encodeURIComponent(companyId)}`, body);
}

export function createOrdersV3Section(companyId: string, body: { code?: string; nameAr: string; nameEn?: string }): Promise<ApiParsedResult<OrdersV3Section>> {
  return apiPost(`${BASE}/catalog/sections?companyId=${encodeURIComponent(companyId)}`, body);
}

export function createOrdersV3Location(companyId: string, body: { code?: string; nameAr: string; nameEn?: string; kind?: string; sectionId?: string | null }): Promise<ApiParsedResult<OrdersV3Location>> {
  return apiPost(`${BASE}/catalog/locations?companyId=${encodeURIComponent(companyId)}`, body);
}

export function createOrdersV3Item(companyId: string, body: {
  sku?: string; nameAr: string; nameEn?: string; itemType: 'purchased' | 'sale' | 'both';
  categoryId?: string | null; baseUnitId: string; sectionIds?: string[]; trackInventory?: boolean;
}): Promise<ApiParsedResult<OrdersV3Item>> {
  return apiPost(`${BASE}/catalog/items?companyId=${encodeURIComponent(companyId)}`, body);
}

export function publishOrdersV3Conversion(companyId: string, body: {
  itemId: string;
  edges: Array<{ fromUnitId: string; toUnitId: string; factor: string; reversible?: boolean; allowDimensionBridge?: boolean }>;
}): Promise<ApiParsedResult<OrdersV3ConversionVersion>> {
  return apiPost(`${BASE}/catalog/conversions/publish?companyId=${encodeURIComponent(companyId)}`, body);
}

export function publishOrdersV3Recipe(companyId: string, body: {
  outputItemId: string; outputQuantity: string; outputUnitId: string;
  lines: Array<{ componentItemId: string; quantity: string; unitId: string; wastePercent?: string }>;
}): Promise<ApiParsedResult<OrdersV3RecipeVersion>> {
  return apiPost(`${BASE}/catalog/recipes/publish?companyId=${encodeURIComponent(companyId)}`, body);
}

export function deactivateOrdersV3Catalog(companyId: string, entity: string, id: string): Promise<ApiParsedResult<{ id: string; deactivated: boolean }>> {
  return apiDelete(`${BASE}/catalog/${encodeURIComponent(entity)}/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`);
}
