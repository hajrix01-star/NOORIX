import { Prisma } from '@prisma/client';
import {
  importSnapshotArr as arr,
  importSnapshotDec as dec,
  importSnapshotDdate as ddate,
} from './backup-logical-import-helpers.util';
import { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';

type Row = Record<string, unknown>;

export type BackupLogicalImportOrdersV4Maps = {
  ordersV4UnitMap: Map<string, string>;
  ordersV4ItemMap: Map<string, string>;
  ordersV4DocumentMap: Map<string, string>;
};

function allocate(rows: Row[], nid: () => string): Map<string, string> {
  return new Map(rows.map((row) => [String(row.id), nid()]));
}

function required(map: Map<string, string>, value: unknown, label: string): string {
  const id = map.get(String(value));
  if (!id) throw new Error(`BACKUP_V4_MISSING_REFERENCE:${label}:${String(value)}`);
  return id;
}

function optional(map: Map<string, string>, value: unknown): string | null {
  if (value == null || value === '') return null;
  return map.get(String(value)) ?? null;
}

function json(value: unknown, fallback: Prisma.InputJsonValue = {}): Prisma.InputJsonValue {
  return value == null ? fallback : value as Prisma.InputJsonValue;
}

function userRef(value: unknown, importingUserId: string): string | null {
  return value == null || value === '' ? null : importingUserId;
}

/**
 * Restores the complete Orders V4 aggregate into a newly-created company.
 * All identities and relations are remapped; immutable ledgers are restored
 * only inside the same privileged transaction used by the logical importer.
 */
export async function importBackupLogicalOrdersV4(
  tx: Prisma.TransactionClient,
  p: BackupLogicalImportTxParams,
): Promise<BackupLogicalImportOrdersV4Maps> {
  const { tenantId, newCompanyId, data, importingUserId, nid } = p;

  const units = arr<Row>(data.ordersV4Units);
  const categories = arr<Row>(data.ordersV4Categories);
  const sections = arr<Row>(data.ordersV4Sections);
  const items = arr<Row>(data.ordersV4Items);
  const itemUnits = arr<Row>(data.ordersV4ItemUnits);
  const itemSections = arr<Row>(data.ordersV4ItemSections);
  const conversionVersions = arr<Row>(data.ordersV4ConversionVersions);
  const conversionEdges = arr<Row>(data.ordersV4ConversionEdges);
  const recipeVersions = arr<Row>(data.ordersV4RecipeVersions);
  const recipeLines = arr<Row>(data.ordersV4RecipeLines);
  const locations = arr<Row>(data.ordersV4Locations);
  const documents = arr<Row>(data.ordersV4Documents);
  const documentLines = arr<Row>(data.ordersV4DocumentLines);
  const priceHistory = arr<Row>(data.ordersV4PriceHistory);
  const inventoryLedger = arr<Row>(data.ordersV4InventoryLedger);
  const custodyLedger = arr<Row>(data.ordersV4CustodyLedger);
  const stocktakes = arr<Row>(data.ordersV4Stocktakes);
  const stocktakeLines = arr<Row>(data.ordersV4StocktakeLines);
  const migrationMap = arr<Row>(data.ordersV4MigrationMap);
  const legacyArchives = arr<Row>(data.ordersV4LegacyArchives);

  const containsLegacyOnlyOrders = [
    'orderProducts', 'orders', 'orderItems', 'staffOrders', 'staffOrderItems',
    'inventoryStocktakes', 'inventoryStocktakeLines', 'inventoryMovements',
  ].some((key) => arr<Row>(data[key]).length > 0);
  if (containsLegacyOnlyOrders && items.length === 0 && documents.length === 0) {
    throw new Error('BACKUP_LEGACY_ORDERS_ARCHIVE_RESTORE_REQUIRED');
  }

  const ordersV4UnitMap = allocate(units, nid);
  const categoryMap = allocate(categories, nid);
  const sectionMap = allocate(sections, nid);
  const ordersV4ItemMap = allocate(items, nid);
  const itemUnitMap = allocate(itemUnits, nid);
  const itemSectionMap = allocate(itemSections, nid);
  const conversionVersionMap = allocate(conversionVersions, nid);
  const conversionEdgeMap = allocate(conversionEdges, nid);
  const recipeVersionMap = allocate(recipeVersions, nid);
  const recipeLineMap = allocate(recipeLines, nid);
  const locationMap = allocate(locations, nid);
  const ordersV4DocumentMap = allocate(documents, nid);
  const documentLineMap = allocate(documentLines, nid);
  const priceHistoryMap = allocate(priceHistory, nid);
  const inventoryLedgerMap = allocate(inventoryLedger, nid);
  const custodyLedgerMap = allocate(custodyLedger, nid);
  const stocktakeMap = allocate(stocktakes, nid);
  const stocktakeLineMap = allocate(stocktakeLines, nid);

  await tx.$executeRaw`SELECT set_config('app.orders_v4_cutover_mode', 'authorized', true)`;

  for (const row of units) {
    await tx.ordersV4Unit.create({ data: {
      id: required(ordersV4UnitMap, row.id, 'unit'), tenantId, companyId: newCompanyId,
      code: String(row.code), nameAr: String(row.nameAr), nameEn: row.nameEn == null ? null : String(row.nameEn),
      dimension: String(row.dimension), canonicalFactor: row.canonicalFactor == null ? null : dec(row.canonicalFactor),
      decimalScale: Number(row.decimalScale ?? 6), isActive: row.isActive !== false,
      sortOrder: Number(row.sortOrder ?? 0), createdAt: ddate(row.createdAt), updatedAt: ddate(row.updatedAt),
    } });
  }
  for (const row of categories) {
    await tx.ordersV4Category.create({ data: {
      id: required(categoryMap, row.id, 'category'), tenantId, companyId: newCompanyId,
      nameAr: String(row.nameAr), nameEn: row.nameEn == null ? null : String(row.nameEn),
      isActive: row.isActive !== false, sortOrder: Number(row.sortOrder ?? 0),
      createdAt: ddate(row.createdAt), updatedAt: ddate(row.updatedAt),
    } });
  }
  for (const row of sections) {
    await tx.ordersV4Section.create({ data: {
      id: required(sectionMap, row.id, 'section'), tenantId, companyId: newCompanyId,
      code: String(row.code), nameAr: String(row.nameAr), nameEn: row.nameEn == null ? null : String(row.nameEn),
      isActive: row.isActive !== false, sortOrder: Number(row.sortOrder ?? 0),
      createdAt: ddate(row.createdAt), updatedAt: ddate(row.updatedAt),
    } });
  }
  for (const row of items) {
    await tx.ordersV4Item.create({ data: {
      id: required(ordersV4ItemMap, row.id, 'item'), tenantId, companyId: newCompanyId,
      sku: row.sku == null ? null : String(row.sku), nameAr: String(row.nameAr), nameEn: row.nameEn == null ? null : String(row.nameEn),
      itemType: String(row.itemType), categoryId: optional(categoryMap, row.categoryId),
      inventoryUnitId: required(ordersV4UnitMap, row.inventoryUnitId, 'item.inventoryUnit'),
      kernelUnitId: required(ordersV4UnitMap, row.kernelUnitId, 'item.kernelUnit'),
      trackInventory: row.trackInventory !== false, isActive: row.isActive !== false,
      sortOrder: Number(row.sortOrder ?? 0), createdAt: ddate(row.createdAt), updatedAt: ddate(row.updatedAt),
    } });
  }
  for (const row of itemUnits) {
    await tx.ordersV4ItemUnit.create({ data: {
      id: required(itemUnitMap, row.id, 'itemUnit'), tenantId, companyId: newCompanyId,
      itemId: required(ordersV4ItemMap, row.itemId, 'itemUnit.item'), unitId: required(ordersV4UnitMap, row.unitId, 'itemUnit.unit'),
      purchaseLabel: row.purchaseLabel == null ? null : String(row.purchaseLabel), isOrderEnabled: row.isOrderEnabled === true,
      lastPrice: row.lastPrice == null ? null : dec(row.lastPrice), lastPriceAt: row.lastPriceAt ? ddate(row.lastPriceAt) : null,
      isActive: row.isActive !== false, sortOrder: Number(row.sortOrder ?? 0),
      createdAt: ddate(row.createdAt), updatedAt: ddate(row.updatedAt),
    } });
  }
  for (const row of itemSections) {
    await tx.ordersV4ItemSection.create({ data: {
      id: required(itemSectionMap, row.id, 'itemSection'), tenantId, companyId: newCompanyId,
      itemId: required(ordersV4ItemMap, row.itemId, 'itemSection.item'), sectionId: required(sectionMap, row.sectionId, 'itemSection.section'),
      createdAt: ddate(row.createdAt),
    } });
  }
  for (const row of conversionVersions) {
    await tx.ordersV4ConversionVersion.create({ data: {
      id: required(conversionVersionMap, row.id, 'conversionVersion'), tenantId, companyId: newCompanyId,
      itemId: required(ordersV4ItemMap, row.itemId, 'conversionVersion.item'), version: Number(row.version),
      status: String(row.status ?? 'published'), contentHash: String(row.contentHash),
      publishedAt: row.publishedAt ? ddate(row.publishedAt) : null, retiredAt: row.retiredAt ? ddate(row.retiredAt) : null,
      createdByUserId: userRef(row.createdByUserId, importingUserId), createdAt: ddate(row.createdAt),
    } });
  }
  for (const row of conversionEdges) {
    await tx.ordersV4ConversionEdge.create({ data: {
      id: required(conversionEdgeMap, row.id, 'conversionEdge'), tenantId, companyId: newCompanyId,
      versionId: required(conversionVersionMap, row.versionId, 'conversionEdge.version'),
      fromUnitId: required(ordersV4UnitMap, row.fromUnitId, 'conversionEdge.fromUnit'),
      toUnitId: required(ordersV4UnitMap, row.toUnitId, 'conversionEdge.toUnit'), factor: dec(row.factor),
      reversible: row.reversible !== false, allowDimensionBridge: row.allowDimensionBridge === true,
      sortOrder: Number(row.sortOrder ?? 0), createdAt: ddate(row.createdAt),
    } });
  }
  for (const row of recipeVersions) {
    await tx.ordersV4RecipeVersion.create({ data: {
      id: required(recipeVersionMap, row.id, 'recipeVersion'), tenantId, companyId: newCompanyId,
      outputItemId: required(ordersV4ItemMap, row.outputItemId, 'recipeVersion.item'), outputQuantity: dec(row.outputQuantity),
      outputUnitId: required(ordersV4UnitMap, row.outputUnitId, 'recipeVersion.unit'), version: Number(row.version),
      status: String(row.status ?? 'published'), contentHash: String(row.contentHash),
      publishedAt: row.publishedAt ? ddate(row.publishedAt) : null, retiredAt: row.retiredAt ? ddate(row.retiredAt) : null,
      createdByUserId: userRef(row.createdByUserId, importingUserId), createdAt: ddate(row.createdAt),
    } });
  }
  for (const row of recipeLines) {
    await tx.ordersV4RecipeLine.create({ data: {
      id: required(recipeLineMap, row.id, 'recipeLine'), tenantId, companyId: newCompanyId,
      recipeVersionId: required(recipeVersionMap, row.recipeVersionId, 'recipeLine.version'),
      componentItemId: required(ordersV4ItemMap, row.componentItemId, 'recipeLine.item'), quantity: dec(row.quantity),
      unitId: required(ordersV4UnitMap, row.unitId, 'recipeLine.unit'), sortOrder: Number(row.sortOrder ?? 0),
      createdAt: ddate(row.createdAt),
    } });
  }
  for (const row of locations) {
    await tx.ordersV4Location.create({ data: {
      id: required(locationMap, row.id, 'location'), tenantId, companyId: newCompanyId,
      code: String(row.code), nameAr: String(row.nameAr), nameEn: row.nameEn == null ? null : String(row.nameEn),
      kind: String(row.kind ?? 'warehouse'), sectionId: optional(sectionMap, row.sectionId), isActive: row.isActive !== false,
      createdAt: ddate(row.createdAt), updatedAt: ddate(row.updatedAt),
    } });
  }

  // Documents are inserted first without self-reversal links, then linked in a second pass.
  for (const row of documents) {
    await tx.ordersV4Document.create({ data: {
      id: required(ordersV4DocumentMap, row.id, 'document'), tenantId, companyId: newCompanyId,
      documentNumber: String(row.documentNumber), documentType: String(row.documentType),
      registrationEntryType: row.registrationEntryType == null ? null : String(row.registrationEntryType),
      status: String(row.status ?? 'prepared'), paymentMethod: row.paymentMethod == null ? null : String(row.paymentMethod),
      documentDate: ddate(row.documentDate), sectionId: optional(sectionMap, row.sectionId),
      locationId: required(locationMap, row.locationId, 'document.location'),
      pettyCashAmount: row.pettyCashAmount == null ? null : dec(row.pettyCashAmount), subtotal: dec(row.subtotal),
      totalAmount: dec(row.totalAmount), operationalCost: dec(row.operationalCost), notes: row.notes == null ? null : String(row.notes),
      revision: Number(row.revision ?? 1), idempotencyKey: String(row.idempotencyKey), requestHash: String(row.requestHash),
      calculationVersion: Number(row.calculationVersion ?? 1), calculationSnapshot: json(row.calculationSnapshot), reversalOfId: null,
      receivedAt: row.receivedAt ? ddate(row.receivedAt) : null,
      receivedByUserId: userRef(row.receivedByUserId, importingUserId),
      createdByUserId: userRef(row.createdByUserId, importingUserId), updatedByUserId: userRef(row.updatedByUserId, importingUserId),
      createdAt: ddate(row.createdAt), updatedAt: ddate(row.updatedAt),
    } });
  }
  for (const row of documents) {
    const reversalOfId = optional(ordersV4DocumentMap, row.reversalOfId);
    if (reversalOfId) await tx.ordersV4Document.update({ where: { id: required(ordersV4DocumentMap, row.id, 'document') }, data: { reversalOfId } });
  }
  for (const row of documentLines) {
    await tx.ordersV4DocumentLine.create({ data: {
      id: required(documentLineMap, row.id, 'documentLine'), tenantId, companyId: newCompanyId,
      documentId: required(ordersV4DocumentMap, row.documentId, 'documentLine.document'),
      itemId: required(ordersV4ItemMap, row.itemId, 'documentLine.item'), lineNumber: Number(row.lineNumber),
      itemNameSnapshot: String(row.itemNameSnapshot), inputQuantity: dec(row.inputQuantity),
      inputUnitId: required(ordersV4UnitMap, row.inputUnitId, 'documentLine.inputUnit'), baseQuantity: dec(row.baseQuantity),
      baseUnitId: required(ordersV4UnitMap, row.baseUnitId, 'documentLine.baseUnit'), unitPrice: dec(row.unitPrice),
      priceUnitId: required(ordersV4UnitMap, row.priceUnitId, 'documentLine.priceUnit'), priceQuantity: dec(row.priceQuantity),
      lineTotal: dec(row.lineTotal), operationalCost: dec(row.operationalCost),
      cancellationReasons: row.cancellationReasons == null ? undefined : json(row.cancellationReasons),
      cancellationNote: row.cancellationNote == null ? null : String(row.cancellationNote),
      conversionVersionId: optional(conversionVersionMap, row.conversionVersionId), recipeVersionId: optional(recipeVersionMap, row.recipeVersionId),
      conversionSnapshot: json(row.conversionSnapshot), recipeSnapshot: row.recipeSnapshot == null ? undefined : json(row.recipeSnapshot),
      costSnapshot: row.costSnapshot == null ? undefined : json(row.costSnapshot), calculationSnapshot: json(row.calculationSnapshot),
      createdAt: ddate(row.createdAt),
    } });
  }
  for (const row of priceHistory) {
    await tx.ordersV4PriceHistory.create({ data: {
      id: required(priceHistoryMap, row.id, 'priceHistory'), tenantId, companyId: newCompanyId,
      itemId: required(ordersV4ItemMap, row.itemId, 'priceHistory.item'), unitId: required(ordersV4UnitMap, row.unitId, 'priceHistory.unit'),
      inventoryUnitId: required(ordersV4UnitMap, row.inventoryUnitId, 'priceHistory.inventoryUnit'),
      documentId: required(ordersV4DocumentMap, row.documentId, 'priceHistory.document'),
      documentLineId: required(documentLineMap, row.documentLineId, 'priceHistory.line'),
      unitPrice: dec(row.unitPrice), inventoryUnitPrice: dec(row.inventoryUnitPrice),
      conversionVersionId: optional(conversionVersionMap, row.conversionVersionId), effectiveAt: ddate(row.effectiveAt), createdAt: ddate(row.createdAt),
    } });
  }
  for (const row of inventoryLedger) {
    await tx.ordersV4InventoryLedgerEntry.create({ data: {
      id: required(inventoryLedgerMap, row.id, 'inventoryLedger'), tenantId, companyId: newCompanyId,
      itemId: required(ordersV4ItemMap, row.itemId, 'inventoryLedger.item'),
      inventoryUnitId: required(ordersV4UnitMap, row.inventoryUnitId, 'inventoryLedger.unit'),
      locationId: required(locationMap, row.locationId, 'inventoryLedger.location'),
      documentLineId: optional(documentLineMap, row.documentLineId), effectiveAt: ddate(row.effectiveAt),
      entryType: String(row.entryType), quantityDelta: dec(row.quantityDelta), unitCost: dec(row.unitCost),
      valueDelta: dec(row.valueDelta), quantityAfter: dec(row.quantityAfter), valueAfter: dec(row.valueAfter),
      averageUnitCostAfter: dec(row.averageUnitCostAfter), sourceType: String(row.sourceType), sourceId: String(row.sourceId),
      sourceKey: String(row.sourceKey), sourceSnapshot: json(row.sourceSnapshot),
      conversionVersionId: optional(conversionVersionMap, row.conversionVersionId), recipeVersionId: optional(recipeVersionMap, row.recipeVersionId),
      reversalOfId: null, createdByUserId: userRef(row.createdByUserId, importingUserId), createdAt: ddate(row.createdAt),
    } });
  }
  for (const row of inventoryLedger) {
    const reversalOfId = optional(inventoryLedgerMap, row.reversalOfId);
    if (reversalOfId) await tx.ordersV4InventoryLedgerEntry.update({ where: { id: required(inventoryLedgerMap, row.id, 'inventoryLedger') }, data: { reversalOfId } });
  }
  for (const row of custodyLedger) {
    await tx.ordersV4CustodyLedgerEntry.create({ data: {
      id: required(custodyLedgerMap, row.id, 'custodyLedger'), tenantId, companyId: newCompanyId,
      documentId: optional(ordersV4DocumentMap, row.documentId), effectiveAt: ddate(row.effectiveAt),
      entryType: String(row.entryType), amountDelta: dec(row.amountDelta), balanceAfter: dec(row.balanceAfter),
      sourceKey: String(row.sourceKey), sourceSnapshot: json(row.sourceSnapshot), reversalOfId: null,
      createdByUserId: userRef(row.createdByUserId, importingUserId), createdAt: ddate(row.createdAt),
    } });
  }
  for (const row of custodyLedger) {
    const reversalOfId = optional(custodyLedgerMap, row.reversalOfId);
    if (reversalOfId) await tx.ordersV4CustodyLedgerEntry.update({ where: { id: required(custodyLedgerMap, row.id, 'custodyLedger') }, data: { reversalOfId } });
  }
  for (const row of stocktakes) {
    await tx.ordersV4Stocktake.create({ data: {
      id: required(stocktakeMap, row.id, 'stocktake'), tenantId, companyId: newCompanyId,
      stocktakeNumber: String(row.stocktakeNumber), stocktakeDate: ddate(row.stocktakeDate),
      locationId: required(locationMap, row.locationId, 'stocktake.location'), status: String(row.status ?? 'posted'),
      notes: row.notes == null ? null : String(row.notes), idempotencyKey: String(row.idempotencyKey), requestHash: String(row.requestHash),
      createdByUserId: userRef(row.createdByUserId, importingUserId), createdAt: ddate(row.createdAt),
    } });
  }
  for (const row of stocktakeLines) {
    await tx.ordersV4StocktakeLine.create({ data: {
      id: required(stocktakeLineMap, row.id, 'stocktakeLine'), tenantId, companyId: newCompanyId,
      stocktakeId: required(stocktakeMap, row.stocktakeId, 'stocktakeLine.stocktake'),
      itemId: required(ordersV4ItemMap, row.itemId, 'stocktakeLine.item'), unitId: required(ordersV4UnitMap, row.unitId, 'stocktakeLine.unit'),
      expectedQuantity: dec(row.expectedQuantity), physicalQuantity: dec(row.physicalQuantity), varianceQuantity: dec(row.varianceQuantity),
      unitCost: dec(row.unitCost), varianceValue: dec(row.varianceValue),
    } });
  }

  const targetMap = (entity: unknown, id: unknown): string => {
    const key = String(entity);
    const sourceId = String(id);
    if (key === 'OrdersV4Unit') return ordersV4UnitMap.get(sourceId) ?? sourceId;
    if (key === 'OrdersV4Category') return categoryMap.get(sourceId) ?? sourceId;
    if (key === 'OrdersV4Section') return sectionMap.get(sourceId) ?? sourceId;
    if (key === 'OrdersV4Item') return ordersV4ItemMap.get(sourceId) ?? sourceId;
    if (key === 'OrdersV4Document') return ordersV4DocumentMap.get(sourceId) ?? sourceId;
    if (key === 'OrdersV4InventoryLedgerEntry') return inventoryLedgerMap.get(sourceId) ?? sourceId;
    return sourceId;
  };
  for (const row of migrationMap) {
    await tx.ordersV4MigrationMap.create({ data: {
      id: nid(), tenantId, companyId: newCompanyId, sourceSystem: String(row.sourceSystem),
      sourceEntity: String(row.sourceEntity), sourceId: String(row.sourceId), targetEntity: String(row.targetEntity),
      targetId: targetMap(row.targetEntity, row.targetId), sourceChecksum: String(row.sourceChecksum),
      migrationRunId: `${String(row.migrationRunId)}:restore:${newCompanyId}`, status: String(row.status ?? 'verified'),
      detail: row.detail == null ? undefined : json(row.detail), migratedAt: ddate(row.migratedAt),
    } });
  }
  for (const row of legacyArchives) {
    await tx.ordersV4LegacyArchive.create({ data: {
      id: nid(), tenantId, companyId: newCompanyId,
      sourceSystem: String(row.sourceSystem), sourceTable: String(row.sourceTable),
      sourceId: String(row.sourceId), sourceChecksum: String(row.sourceChecksum),
      payload: json(row.payload), archivedAt: ddate(row.archivedAt),
    } });
  }

  return { ordersV4UnitMap, ordersV4ItemMap, ordersV4DocumentMap };
}
