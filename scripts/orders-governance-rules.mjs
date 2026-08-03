export const LEGACY_ORDERS_PATHS = [
  'backend/src/orders',
  'src/modules/Orders',
  'src/hooks/orders',
  'src/hooks/useOrders.ts',
  'src/services/domains/apiEndpoints/orders.ts',
  'src/services/queryKeys/orders.ts',
  'src/types/api/domains/orders.ts',
  'src/utils/ordersExport.ts',
  'src/i18n/translations/orders.ts',
  'backend/src/backup/backup-logical-import-orders-inventory.util.ts',
  'backend/src/orders-v4/orders-v4-legacy-cutover.service.ts',
  'backend/src/orders-v4/orders-v4-legacy-cutover-import.service.ts',
  'backend/src/orders-v4/orders-v4-legacy-cutover.mapping.ts',
];

export const LEGACY_PERMISSION_KEYS = [
  'VIEW_ORDERS',
  'VIEW_INTERNAL_REGISTRATION',
  'ORDERS_READ',
  'ORDERS_WRITE',
  'ORDERS_DELETE',
  'STAFF_ORDERS_READ',
  'STAFF_ORDERS_SUBMIT',
  'ORDERS_STAFF_SUBMIT',
];

export const LEGACY_PRISMA_DELEGATES = [
  'orderProduct',
  'orderCategory',
  'orderSection',
  'orderCatalogUnit',
  'orderConversionTemplate',
  'inventoryStocktake',
  'inventoryStocktakeLine',
  'inventoryMovement',
  'inventoryLocationV2',
  'inventoryDefinitionVersionV2',
  'inventoryLedgerEntryV2',
  'staffOrder',
  'staffOrderItem',
  'shishaInventorySettings',
  'shishaInventoryMovement',
  'shishaStocktake',
];

export function findLegacyRuntimeReferences(source) {
  const matches = [];
  for (const key of LEGACY_PERMISSION_KEYS) {
    if (new RegExp(`\\b${key}\\b`).test(source)) matches.push(`legacy permission ${key}`);
  }
  for (const delegate of LEGACY_PRISMA_DELEGATES) {
    if (new RegExp(`\\.${delegate}\\b`).test(source)) matches.push(`legacy Prisma delegate ${delegate}`);
  }
  if (/from\s+['"][^'"]*\/orders(?:\/|['"])/.test(source)) matches.push('legacy Orders import');
  if (/['"]\/orders['"]/.test(source)) matches.push('legacy /orders route');
  if (/OrdersV4LegacyCutover|orders-v4-legacy-cutover/.test(source)) matches.push('legacy cutover runtime');
  return matches;
}
