import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { buildCompanyLogicalSnapshot } from './backup-company-export';
import { stringifyLogicalSnapshotReplacingDecimals } from './backup-company-snapshot-json.util';
import { importBackupLogicalOrdersAndInventory } from './backup-logical-import-orders-inventory.util';
import type { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';

type Row = Record<string, unknown>;

const date = new Date('2026-07-31T00:00:00.000Z');

function exportPrisma(data: Record<string, Row[]>) {
  const delegates = new Map<PropertyKey, object>();
  return new Proxy({} as object, {
    get(_target, property) {
      if (property === 'company') {
        return {
          findUnique: jest.fn().mockResolvedValue({
            id: 'company-source',
            tenantId: 'tenant-1',
            nameAr: 'Source',
          }),
        };
      }
      if (!delegates.has(property)) {
        delegates.set(property, {
          findMany: jest.fn().mockResolvedValue(data[String(property)] ?? []),
        });
      }
      return delegates.get(property);
    },
  }) as PrismaService;
}

function importTx(existingUserIds: string[] = []) {
  const log: string[] = [];
  const writes: Record<string, Row[]> = {};
  const delegates = new Map<string, object>();
  const tx = new Proxy({} as object, {
    get(_target, property) {
      const name = String(property);
      if (name === 'user') {
        return {
          findMany: jest.fn().mockResolvedValue(existingUserIds.map((id) => ({ id }))),
        };
      }
      if (!delegates.has(name)) {
        writes[name] = [];
        delegates.set(name, {
          create: jest.fn(async ({ data }: { data: Row }) => {
            log.push(name);
            writes[name].push(data);
            return data;
          }),
        });
      }
      return delegates.get(name);
    },
  }) as Prisma.TransactionClient;
  return { tx, log, writes };
}

function importParams(data: Record<string, unknown>) {
  let sequence = 0;
  return {
    tenantId: 'tenant-1',
    newCompanyId: 'company-restored',
    data,
    nameAr: 'Restored',
    resolvedNameEn: null,
    importingUserId: 'import-user',
    co: {},
    strictAlloc: false,
    logger: new Logger('BackupOrdersInventoryRoundtrip'),
    nid: () => `new-${++sequence}`,
  } satisfies BackupLogicalImportTxParams;
}

function findByName(rows: Row[], nameAr: string): Row {
  const row = rows.find((entry) => entry.nameAr === nameAr);
  if (!row) throw new Error(`Missing restored row: ${nameAr}`);
  return row;
}

describe('orders and inventory logical backup round-trip', () => {
  it('exports and restores dependencies, snapshots, and remapped JSON references', async () => {
    const sourceData: Record<string, Row[]> = {
      orderCategory: [{
        id: 'category-1', companyId: 'company-source', nameAr: 'Materials',
        nameEn: null, sortOrder: 1, isActive: true, createdAt: date, updatedAt: date,
      }],
      orderSection: [{
        id: 'section-1', companyId: 'company-source', nameAr: 'Kitchen',
        nameEn: 'Kitchen', sortOrder: 1, createdAt: date, updatedAt: date,
      }],
      orderCatalogUnit: [{
        id: 'unit-1', companyId: 'company-source', code: 'carton', nameAr: 'Carton',
        nameEn: 'Carton', kind: 'package', isDefault: false, isActive: true,
        sortOrder: 1, createdAt: date, updatedAt: date,
      }],
      orderConversionTemplate: [{
        id: 'template-1', companyId: 'company-source', code: 'carton-pack',
        nameAr: 'Carton to pack', nameEn: null, description: 'Template',
        conversions: [{ fromUnit: 'carton', toUnit: 'pack', multiplier: '10' }],
        isDefault: true, isActive: true, sortOrder: 1, createdAt: date, updatedAt: date,
      }],
      orderProduct: [
        {
          id: 'material-1', companyId: 'company-source', categoryId: 'category-1',
          conversionTemplateId: 'template-1', nameAr: 'Charcoal', nameEn: 'Charcoal',
          unit: 'piece', sizes: null, packaging: 'carton', lastPrice: new Prisma.Decimal('25.5'),
          variants: [{ unit: 'carton', quantityMultiplier: '100' }],
          inventoryConversions: [{ fromUnit: 'carton', toUnit: 'piece', multiplier: '100' }],
          recipe: null, sections: ['Kitchen'], sectionIds: ['section-1'], productType: 'order',
          isActive: true, sortOrder: 1, createdAt: date, updatedAt: date,
        },
        {
          id: 'sale-1', companyId: 'company-source', categoryId: null,
          conversionTemplateId: null, nameAr: 'Meal', nameEn: 'Meal', unit: 'piece',
          sizes: null, packaging: null, lastPrice: new Prisma.Decimal('50'), variants: null,
          inventoryConversions: null,
          recipe: [{ materialType: 'material', materialProductId: 'material-1', quantity: '2', unit: 'piece' }],
          sections: ['Kitchen'], sectionIds: ['section-1'], productType: 'sale',
          isActive: true, sortOrder: 2, createdAt: date, updatedAt: date,
        },
      ],
      order: [{
        id: 'order-1', companyId: 'company-source', orderNumber: 'ORD-1', orderDate: date,
        orderType: 'external', pettyCashAmount: new Prisma.Decimal('10'),
        totalAmount: new Prisma.Decimal('51'), notes: 'Purchase',
        sourceStaffOrderIds: ['staff-1'], status: 'active', createdAt: date, updatedAt: date,
      }],
      orderItem: [{
        id: 'order-item-1', orderId: 'order-1', productId: 'material-1', size: null,
        packaging: 'carton', unit: 'carton', quantity: new Prisma.Decimal('2'),
        quantityMultiplier: new Prisma.Decimal('100'),
        inventoryBaseQuantitySnapshot: new Prisma.Decimal('200'),
        unitPrice: new Prisma.Decimal('25.5'), amount: new Prisma.Decimal('51'),
      }],
      staffOrder: [{
        id: 'staff-1', companyId: 'company-source', userId: 'user-1', sectionName: 'Kitchen',
        orderType: 'sale', entryType: 'issue', status: 'sent', logRef: 'L-1', saleDate: date,
        notes: null, sentAt: date, purchaseOrderId: 'order-1', createdAt: date, updatedAt: date,
      }],
      staffOrderItem: [{
        id: 'staff-item-1', staffOrderId: 'staff-1', productId: 'sale-1',
        quantity: new Prisma.Decimal('3'), quantityMultiplier: new Prisma.Decimal('1'),
        inventoryConsumptionSnapshot: {
          version: 1,
          source: 'captured',
          soldBaseQuantity: '3',
          components: [{ materialProductId: 'material-1', materialBaseUnit: 'piece', quantityBase: '6' }],
        },
        size: null, packaging: null, unit: 'piece', unitPrice: new Prisma.Decimal('50'),
        notes: null, cancellationReasons: [{ reason: 'none' }], createdAt: date,
      }],
      inventoryStocktake: [{
        id: 'stocktake-1', companyId: 'company-source', stocktakeDate: date,
        status: 'approved', notes: 'Count', createdByUserId: 'user-1', createdAt: date,
      }],
      inventoryStocktakeLine: [{
        id: 'stocktake-line-1', companyId: 'company-source', stocktakeId: 'stocktake-1',
        stocktakeDate: date, productId: 'material-1', unit: 'piece',
        expectedQuantity: new Prisma.Decimal('194'), physicalQuantity: new Prisma.Decimal('190'),
        varianceQuantity: new Prisma.Decimal('-4'),
      }],
      inventoryMovement: [{
        id: 'movement-1', companyId: 'company-source', productId: 'material-1',
        transactionDate: date, movementType: 'stocktake_adjustment',
        quantityBase: new Prisma.Decimal('-4'), stocktakeId: 'stocktake-1',
        sourceKey: 'inventory-stocktake:stocktake-1:material-1', notes: 'Count',
        createdByUserId: 'missing-user', createdAt: date,
      }],
    };
    const snapshot = await buildCompanyLogicalSnapshot(exportPrisma(sourceData), 'company-source');
    const serialized = JSON.parse(stringifyLogicalSnapshotReplacingDecimals(snapshot)) as {
      meta: { version: number };
      counts: Record<string, number>;
      data: Record<string, unknown>;
    };

    expect(serialized.meta.version).toBe(5);
    expect(serialized.counts).toEqual(expect.objectContaining({
      orderConversionTemplates: 1,
      orderProducts: 2,
      staffOrders: 1,
      staffOrderItems: 1,
      inventoryStocktakes: 1,
      inventoryStocktakeLines: 1,
      inventoryMovements: 1,
    }));

    const { tx, log, writes } = importTx(['user-1']);
    const maps = await importBackupLogicalOrdersAndInventory(tx, importParams(serialized.data));
    const restoredMaterialId = maps.orderProductMap.get('material-1');
    const restoredSaleId = maps.orderProductMap.get('sale-1');
    const restoredSectionId = maps.orderSectionMap.get('section-1');
    const restoredStaffOrderId = maps.staffOrderMap.get('staff-1');
    const restoredOrderId = maps.orderMap.get('order-1');
    const restoredStocktakeId = maps.inventoryStocktakeMap.get('stocktake-1');

    expect(findByName(writes.orderProduct, 'Charcoal')).toEqual(expect.objectContaining({
      conversionTemplateId: maps.orderConversionTemplateMap.get('template-1'),
      inventoryConversions: [{ fromUnit: 'carton', toUnit: 'piece', multiplier: '100' }],
      sectionIds: [restoredSectionId],
      productType: 'order',
    }));
    expect(findByName(writes.orderProduct, 'Meal').recipe).toEqual([
      expect.objectContaining({ materialProductId: restoredMaterialId }),
    ]);
    expect(writes.order[0].sourceStaffOrderIds).toEqual([restoredStaffOrderId]);
    expect(writes.orderItem[0]).toEqual(expect.objectContaining({
      orderId: restoredOrderId,
      productId: restoredMaterialId,
      quantityMultiplier: expect.objectContaining({}),
      inventoryBaseQuantitySnapshot: expect.objectContaining({}),
    }));
    expect(String(writes.orderItem[0].quantityMultiplier)).toBe('100');
    expect(String(writes.orderItem[0].inventoryBaseQuantitySnapshot)).toBe('200');
    expect(writes.staffOrder[0]).toEqual(expect.objectContaining({
      id: restoredStaffOrderId,
      userId: 'user-1',
      purchaseOrderId: restoredOrderId,
    }));
    expect(writes.staffOrderItem[0]).toEqual(expect.objectContaining({
      productId: restoredSaleId,
      inventoryConsumptionSnapshot: expect.objectContaining({
        components: [expect.objectContaining({ materialProductId: restoredMaterialId })],
      }),
    }));
    expect(writes.inventoryStocktakeLine[0]).toEqual(expect.objectContaining({
      stocktakeId: restoredStocktakeId,
      productId: restoredMaterialId,
    }));
    expect(writes.inventoryMovement[0]).toEqual(expect.objectContaining({
      stocktakeId: restoredStocktakeId,
      productId: restoredMaterialId,
      createdByUserId: 'import-user',
    }));
    expect(writes.inventoryMovement[0].sourceKey).toBe(
      `inventory-stocktake:${restoredStocktakeId}:${restoredMaterialId}`,
    );
    expect(writes.inventoryMovement[0].sourceKey).not.toBe(sourceData.inventoryMovement[0].sourceKey);

    expect(log.indexOf('orderConversionTemplate')).toBeLessThan(log.indexOf('orderProduct'));
    expect(log.indexOf('orderProduct')).toBeLessThan(log.indexOf('order'));
    expect(log.indexOf('order')).toBeLessThan(log.indexOf('staffOrder'));
    expect(log.indexOf('staffOrder')).toBeLessThan(log.indexOf('staffOrderItem'));
    expect(log.indexOf('inventoryStocktake')).toBeLessThan(log.indexOf('inventoryStocktakeLine'));
    expect(log.indexOf('inventoryStocktake')).toBeLessThan(log.indexOf('inventoryMovement'));
  });

  it('restores a version 4 style payload with safe defaults and no new collections', async () => {
    const legacyData = {
      orderCategories: [{
        id: 'category-1', nameAr: 'Legacy', createdAt: date.toISOString(), updatedAt: date.toISOString(),
      }],
      orderProducts: [{
        id: 'product-1', categoryId: 'category-1', nameAr: 'Legacy product', unit: 'piece',
        lastPrice: '4', createdAt: date.toISOString(), updatedAt: date.toISOString(),
      }],
      orders: [{
        id: 'order-1', orderNumber: 'ORD-LEGACY', orderDate: date.toISOString(),
        orderType: 'internal', totalAmount: '8', createdAt: date.toISOString(), updatedAt: date.toISOString(),
      }],
      orderItems: [{
        id: 'item-1', orderId: 'order-1', productId: 'product-1', quantity: '2',
        unitPrice: '4', amount: '8',
      }],
    };
    const { tx, writes } = importTx();

    await expect(importBackupLogicalOrdersAndInventory(tx, importParams(legacyData))).resolves.toBeDefined();
    expect(writes.orderProduct[0]).toEqual(expect.objectContaining({
      productType: 'order',
      conversionTemplateId: null,
    }));
    expect(writes.orderItem[0].inventoryBaseQuantitySnapshot).toBeNull();
    expect(String(writes.orderItem[0].quantityMultiplier)).toBe('1');
    expect(writes.staffOrder ?? []).toHaveLength(0);
    expect(writes.inventoryMovement ?? []).toHaveLength(0);
  });
});
