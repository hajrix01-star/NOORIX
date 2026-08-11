import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { buildCompanyLogicalSnapshot } from './backup-company-export';
import { stringifyLogicalSnapshotReplacingDecimals } from './backup-company-snapshot-json.util';
import { importBackupLogicalOrdersV4 } from './backup-logical-import-orders-v4.util';
import type { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';

type Row = Record<string, unknown>;
const date = new Date('2026-08-03T00:00:00.000Z');

function exportPrisma(data: Record<string, Row[]>) {
  const delegates = new Map<PropertyKey, object>();
  return new Proxy({} as object, {
    get(_target, property) {
      if (property === 'company') {
        return { findUnique: jest.fn().mockResolvedValue({ id: 'source-company', tenantId: 'tenant-1', nameAr: 'Source' }) };
      }
      if (!delegates.has(property)) {
        delegates.set(property, { findMany: jest.fn().mockResolvedValue(data[String(property)] ?? []) });
      }
      return delegates.get(property);
    },
  }) as PrismaService;
}

function importTx() {
  const writes: Record<string, Row[]> = {};
  const log: string[] = [];
  const delegates = new Map<string, object>();
  const tx = new Proxy({} as object, {
    get(_target, property) {
      const name = String(property);
      if (name === '$executeRaw') return jest.fn().mockResolvedValue(1);
      if (!delegates.has(name)) {
        writes[name] = [];
        delegates.set(name, {
          create: jest.fn(async ({ data }: { data: Row }) => {
            log.push(name);
            writes[name].push(data);
            return data;
          }),
          update: jest.fn(async ({ data }: { data: Row }) => data),
        });
      }
      return delegates.get(name);
    },
  }) as Prisma.TransactionClient;
  return { tx, writes, log };
}

function params(data: Record<string, unknown>) {
  let sequence = 0;
  return {
    tenantId: 'tenant-1', newCompanyId: 'restored-company', data, counts: {},
    nameAr: 'Restored', resolvedNameEn: null, importingUserId: 'import-user',
    co: {}, strictAlloc: false, logger: new Logger('BackupOrdersV4Roundtrip'),
    nid: () => `new-${++sequence}`,
  } satisfies BackupLogicalImportTxParams;
}

describe('Orders V4 logical backup round-trip', () => {
  it('fails closed instead of silently discarding a legacy-only Orders snapshot', async () => {
    const { tx } = importTx();
    await expect(importBackupLogicalOrdersV4(tx, params({
      orderProducts: [{ id: 'legacy-item' }],
      orders: [{ id: 'legacy-order' }],
    }))).rejects.toThrow('BACKUP_LEGACY_ORDERS_ARCHIVE_RESTORE_REQUIRED');
  });

  it('exports the complete aggregate and restores remapped central references', async () => {
    const sourceData: Record<string, Row[]> = {
      ordersV4Unit: [
        { id: 'unit-carton', code: 'carton', nameAr: 'كرتون', dimension: 'count', decimalScale: 0, createdAt: date, updatedAt: date },
        { id: 'unit-piece', code: 'piece', nameAr: 'حبة', dimension: 'count', decimalScale: 0, createdAt: date, updatedAt: date },
      ],
      ordersV4Category: [{ id: 'category-1', nameAr: 'مواد', createdAt: date, updatedAt: date }],
      ordersV4Section: [{ id: 'section-1', code: 'kitchen', nameAr: 'مطبخ', createdAt: date, updatedAt: date }],
      ordersV4Item: [{
        id: 'item-1', nameAr: 'فحم', itemType: 'purchased', categoryId: 'category-1',
        inventoryUnitId: 'unit-piece', kernelUnitId: 'unit-piece', createdAt: date, updatedAt: date,
      }],
      ordersV4ItemUnit: [{
        id: 'item-unit-1', itemId: 'item-1', unitId: 'unit-carton', isOrderEnabled: true,
        lastPrice: new Prisma.Decimal('25'), createdAt: date, updatedAt: date,
      }],
      ordersV4ItemSection: [{ id: 'item-section-1', itemId: 'item-1', sectionId: 'section-1', createdAt: date }],
      ordersV4ConversionVersion: [{
        id: 'conversion-1', itemId: 'item-1', version: 1, contentHash: 'conversion-hash',
        status: 'published', publishedAt: date, createdByUserId: 'source-user', createdAt: date,
      }],
      ordersV4ConversionEdge: [{
        id: 'edge-1', versionId: 'conversion-1', fromUnitId: 'unit-carton', toUnitId: 'unit-piece',
        factor: new Prisma.Decimal('100'), createdAt: date,
      }],
      ordersV4Location: [{ id: 'location-1', code: 'main', nameAr: 'الرئيسي', kind: 'warehouse', createdAt: date, updatedAt: date }],
      ordersV4Document: [{
        id: 'document-1', documentNumber: 'V4-1', documentType: 'purchase', status: 'received',
        paymentMethod: 'custody', documentDate: date, locationId: 'location-1', subtotal: new Prisma.Decimal('50'),
        totalAmount: new Prisma.Decimal('50'), operationalCost: new Prisma.Decimal('0'), idempotencyKey: 'doc-1',
        requestHash: 'doc-hash', calculationSnapshot: { version: 1 }, receivedAt: date,
        createdByUserId: 'source-user', createdAt: date, updatedAt: date,
      }],
      ordersV4DocumentLine: [{
        id: 'line-1', documentId: 'document-1', itemId: 'item-1', lineNumber: 1, itemNameSnapshot: 'فحم',
        inputQuantity: new Prisma.Decimal('2'), inputUnitId: 'unit-carton', baseQuantity: new Prisma.Decimal('200'),
        baseUnitId: 'unit-piece', unitPrice: new Prisma.Decimal('25'), priceUnitId: 'unit-carton',
        priceQuantity: new Prisma.Decimal('2'), lineTotal: new Prisma.Decimal('50'), operationalCost: new Prisma.Decimal('0'),
        conversionVersionId: 'conversion-1', conversionSnapshot: { factor: '100' }, calculationSnapshot: { version: 1 }, createdAt: date,
      }],
      ordersV4PriceHistory: [{
        id: 'price-1', itemId: 'item-1', unitId: 'unit-carton', inventoryUnitId: 'unit-piece',
        documentId: 'document-1', documentLineId: 'line-1', unitPrice: new Prisma.Decimal('25'),
        inventoryUnitPrice: new Prisma.Decimal('0.25'), conversionVersionId: 'conversion-1', effectiveAt: date, createdAt: date,
      }],
      ordersV4InventoryLedgerEntry: [{
        id: 'ledger-1', sequence: 1n, itemId: 'item-1', inventoryUnitId: 'unit-piece', locationId: 'location-1',
        documentLineId: 'line-1', effectiveAt: date, entryType: 'purchase_receipt', quantityDelta: new Prisma.Decimal('200'),
        unitCost: new Prisma.Decimal('0.25'), valueDelta: new Prisma.Decimal('50'), quantityAfter: new Prisma.Decimal('200'),
        valueAfter: new Prisma.Decimal('50'), averageUnitCostAfter: new Prisma.Decimal('0.25'), sourceType: 'document',
        sourceId: 'document-1', sourceKey: 'document:1', sourceSnapshot: { version: 1 }, conversionVersionId: 'conversion-1', createdAt: date,
      }],
      ordersV4CustodyLedgerEntry: [{
        id: 'custody-1', sequence: 1n, documentId: 'document-1', effectiveAt: date, entryType: 'purchase_spend',
        amountDelta: new Prisma.Decimal('-50'), balanceAfter: new Prisma.Decimal('-50'), sourceKey: 'custody:1',
        sourceSnapshot: { version: 1 }, createdAt: date,
      }],
      ordersV4Stocktake: [{
        id: 'stocktake-1', stocktakeNumber: 'ST-1', stocktakeDate: date, locationId: 'location-1', status: 'posted',
        idempotencyKey: 'stocktake-1', requestHash: 'stocktake-hash', createdAt: date,
      }],
      ordersV4StocktakeLine: [{
        id: 'stocktake-line-1', stocktakeId: 'stocktake-1', itemId: 'item-1', unitId: 'unit-piece',
        expectedQuantity: new Prisma.Decimal('200'), physicalQuantity: new Prisma.Decimal('199'),
        varianceQuantity: new Prisma.Decimal('-1'), unitCost: new Prisma.Decimal('0.25'), varianceValue: new Prisma.Decimal('-0.25'),
      }],
      ordersV4MigrationMap: [{
        id: 'map-1', sourceSystem: 'legacy-orders', sourceEntity: 'OrderProduct', sourceId: 'legacy-product-1',
        targetEntity: 'OrdersV4Item', targetId: 'item-1', sourceChecksum: 'source-hash', migrationRunId: 'run-1',
        status: 'verified', migratedAt: date,
      }],
      ordersV4LegacyArchive: [{
        id: 'archive-1', sourceSystem: 'legacy-orders-shisha', sourceTable: 'shisha_inventory_movements',
        sourceId: 'movement-1', sourceChecksum: 'archive-hash', payload: { quantity_base: '64.000000' }, archivedAt: date,
      }],
    };

    const snapshot = await buildCompanyLogicalSnapshot(exportPrisma(sourceData), 'source-company');
    const serialized = JSON.parse(stringifyLogicalSnapshotReplacingDecimals(snapshot)) as {
      meta: { version: number }; counts: Record<string, number>; data: Record<string, unknown>;
    };
    expect(serialized.meta.version).toBe(14);
    expect(serialized.counts).toEqual(expect.objectContaining({
      ordersV4Units: 2, ordersV4Items: 1, ordersV4ConversionEdges: 1,
      ordersV4Documents: 1, ordersV4InventoryLedger: 1, ordersV4CustodyLedger: 1,
      ordersV4LegacyArchives: 1,
    }));

    const { tx, writes, log } = importTx();
    const maps = await importBackupLogicalOrdersV4(tx, params(serialized.data));
    const restoredItem = maps.ordersV4ItemMap.get('item-1');
    const restoredUnit = maps.ordersV4UnitMap.get('unit-piece');
    const restoredDocument = maps.ordersV4DocumentMap.get('document-1');

    expect(writes.ordersV4Item[0]).toEqual(expect.objectContaining({ id: restoredItem, inventoryUnitId: restoredUnit }));
    expect(writes.ordersV4DocumentLine[0]).toEqual(expect.objectContaining({ itemId: restoredItem, documentId: restoredDocument }));
    expect(writes.ordersV4InventoryLedgerEntry[0]).toEqual(expect.objectContaining({ itemId: restoredItem, documentLineId: writes.ordersV4DocumentLine[0].id }));
    expect(writes.ordersV4CustodyLedgerEntry[0].documentId).toBe(restoredDocument);
    expect(writes.ordersV4MigrationMap[0]).toEqual(expect.objectContaining({ targetEntity: 'OrdersV4Item', targetId: restoredItem }));
    expect(writes.ordersV4LegacyArchive[0]).toEqual(expect.objectContaining({
      companyId: 'restored-company', sourceChecksum: 'archive-hash', payload: { quantity_base: '64.000000' },
    }));
    expect(log.indexOf('ordersV4Unit')).toBeLessThan(log.indexOf('ordersV4Item'));
    expect(log.indexOf('ordersV4Document')).toBeLessThan(log.indexOf('ordersV4DocumentLine'));
  });
});
