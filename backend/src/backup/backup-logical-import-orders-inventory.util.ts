import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  importSnapshotArr as arr,
  importSnapshotDec as dec,
  importSnapshotDdate as ddate,
} from './backup-logical-import-helpers.util';
import { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';

type SnapshotRow = Record<string, unknown>;

export type BackupLogicalImportOrdersInventoryMaps = {
  orderCategoryMap: Map<string, string>;
  orderSectionMap: Map<string, string>;
  orderConversionTemplateMap: Map<string, string>;
  orderProductMap: Map<string, string>;
  orderMap: Map<string, string>;
  staffOrderMap: Map<string, string>;
  inventoryStocktakeMap: Map<string, string>;
};

function allocateIds(rows: SnapshotRow[], nid: () => string): Map<string, string> {
  return new Map(rows.map((row) => [String(row.id), nid()]));
}

function mappedRequired(
  map: ReadonlyMap<string, string>,
  sourceId: unknown,
  label: string,
): string {
  const key = String(sourceId ?? '');
  const mapped = map.get(key);
  if (mapped) return mapped;
  throw new BadRequestException(`Logical backup dependency is missing: ${label} (${key || 'empty'}).`);
}

function optionalJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value == null ? undefined : value as Prisma.InputJsonValue;
}

function remapJsonIdArray(
  value: unknown,
  map: ReadonlyMap<string, string>,
): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) return value as Prisma.InputJsonValue;
  return value.map((entry) => map.get(String(entry)) ?? String(entry));
}

function remapRecipe(
  value: unknown,
  productMap: ReadonlyMap<string, string>,
): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) return value as Prisma.InputJsonValue;
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    const row = entry as SnapshotRow;
    const materialProductId = row.materialProductId == null
      ? row.materialProductId
      : productMap.get(String(row.materialProductId)) ?? String(row.materialProductId);
    return { ...row, materialProductId };
  }) as Prisma.InputJsonValue;
}

function remapConsumptionSnapshot(
  value: unknown,
  productMap: ReadonlyMap<string, string>,
): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value as Prisma.InputJsonValue;
  }
  const snapshot = value as SnapshotRow;
  if (!Array.isArray(snapshot.components)) return snapshot as Prisma.InputJsonValue;
  return {
    ...snapshot,
    components: snapshot.components.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
      const component = entry as SnapshotRow;
      if (component.materialProductId == null) return component;
      return {
        ...component,
        materialProductId: productMap.get(String(component.materialProductId))
          ?? String(component.materialProductId),
      };
    }),
  } as Prisma.InputJsonValue;
}

async function existingTenantUserIds(
  tx: Prisma.TransactionClient,
  tenantId: string,
  rows: SnapshotRow[],
): Promise<Set<string>> {
  const ids = [...new Set(rows.flatMap((row) => [
    row.userId,
    row.createdByUserId,
  ]).filter((value): value is string => typeof value === 'string' && value.length > 0))];
  if (ids.length === 0) return new Set();
  const users = await tx.user.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true },
  });
  return new Set(users.map((user) => user.id));
}

function restoredRequiredUserId(
  value: unknown,
  existingUserIds: ReadonlySet<string>,
  importingUserId: string,
): string {
  const sourceId = typeof value === 'string' ? value : '';
  return sourceId && existingUserIds.has(sourceId) ? sourceId : importingUserId;
}

function restoredOptionalUserId(
  value: unknown,
  existingUserIds: ReadonlySet<string>,
  importingUserId: string,
): string | null {
  if (value == null || String(value).trim() === '') return null;
  return restoredRequiredUserId(value, existingUserIds, importingUserId);
}

export async function importBackupLogicalOrdersAndInventory(
  tx: Prisma.TransactionClient,
  p: BackupLogicalImportTxParams,
): Promise<BackupLogicalImportOrdersInventoryMaps> {
  const { tenantId, newCompanyId, data, importingUserId, nid } = p;
  const categories = arr<SnapshotRow>(data.orderCategories);
  const sections = arr<SnapshotRow>(data.orderSections);
  const catalogUnits = arr<SnapshotRow>(data.orderCatalogUnits);
  const conversionTemplates = arr<SnapshotRow>(data.orderConversionTemplates);
  const products = arr<SnapshotRow>(data.orderProducts);
  const orders = arr<SnapshotRow>(data.orders);
  const orderItems = arr<SnapshotRow>(data.orderItems);
  const staffOrders = arr<SnapshotRow>(data.staffOrders);
  const staffOrderItems = arr<SnapshotRow>(data.staffOrderItems);
  const stocktakes = arr<SnapshotRow>(data.inventoryStocktakes);
  const stocktakeLines = arr<SnapshotRow>(data.inventoryStocktakeLines);
  const movements = arr<SnapshotRow>(data.inventoryMovements);

  const orderCategoryMap = allocateIds(categories, nid);
  const orderSectionMap = allocateIds(sections, nid);
  const orderConversionTemplateMap = allocateIds(conversionTemplates, nid);
  const orderProductMap = allocateIds(products, nid);
  const orderMap = allocateIds(orders, nid);
  const staffOrderMap = allocateIds(staffOrders, nid);
  const inventoryStocktakeMap = allocateIds(stocktakes, nid);
  const existingUserIds = await existingTenantUserIds(
    tx,
    tenantId,
    [...staffOrders, ...stocktakes, ...movements],
  );

  for (const row of categories) {
    await tx.orderCategory.create({
      data: {
        id: mappedRequired(orderCategoryMap, row.id, 'order category'),
        tenantId,
        companyId: newCompanyId,
        nameAr: String(row.nameAr),
        nameEn: (row.nameEn as string | null) ?? null,
        sortOrder: Number(row.sortOrder ?? 0),
        isActive: row.isActive !== false,
        createdAt: ddate(row.createdAt),
        updatedAt: ddate(row.updatedAt),
      },
    });
  }

  for (const row of sections) {
    await tx.orderSection.create({
      data: {
        id: mappedRequired(orderSectionMap, row.id, 'order section'),
        tenantId,
        companyId: newCompanyId,
        nameAr: String(row.nameAr),
        nameEn: (row.nameEn as string | null) ?? null,
        sortOrder: Number(row.sortOrder ?? 0),
        createdAt: ddate(row.createdAt),
        updatedAt: ddate(row.updatedAt),
      },
    });
  }

  for (const row of catalogUnits) {
    await tx.orderCatalogUnit.create({
      data: {
        id: nid(),
        tenantId,
        companyId: newCompanyId,
        code: String(row.code),
        nameAr: String(row.nameAr),
        nameEn: (row.nameEn as string | null) ?? null,
        kind: String(row.kind ?? 'package'),
        isDefault: Boolean(row.isDefault),
        isActive: row.isActive !== false,
        sortOrder: Number(row.sortOrder ?? 0),
        createdAt: ddate(row.createdAt),
        updatedAt: ddate(row.updatedAt),
      },
    });
  }

  for (const row of conversionTemplates) {
    await tx.orderConversionTemplate.create({
      data: {
        id: mappedRequired(orderConversionTemplateMap, row.id, 'order conversion template'),
        tenantId,
        companyId: newCompanyId,
        code: String(row.code),
        nameAr: String(row.nameAr),
        nameEn: (row.nameEn as string | null) ?? null,
        description: (row.description as string | null) ?? null,
        conversions: optionalJson(row.conversions),
        isDefault: Boolean(row.isDefault),
        isActive: row.isActive !== false,
        sortOrder: Number(row.sortOrder ?? 0),
        createdAt: ddate(row.createdAt),
        updatedAt: ddate(row.updatedAt),
      },
    });
  }

  for (const row of products) {
    const categoryId = row.categoryId == null
      ? null
      : orderCategoryMap.get(String(row.categoryId)) ?? null;
    const conversionTemplateId = row.conversionTemplateId == null
      ? null
      : orderConversionTemplateMap.get(String(row.conversionTemplateId)) ?? null;
    await tx.orderProduct.create({
      data: {
        id: mappedRequired(orderProductMap, row.id, 'order product'),
        tenantId,
        companyId: newCompanyId,
        categoryId,
        conversionTemplateId,
        nameAr: String(row.nameAr),
        nameEn: (row.nameEn as string | null) ?? null,
        unit: String(row.unit ?? 'piece'),
        sizes: (row.sizes as string | null) ?? null,
        packaging: (row.packaging as string | null) ?? null,
        lastPrice: dec(row.lastPrice ?? 0),
        variants: optionalJson(row.variants),
        inventoryConversions: optionalJson(row.inventoryConversions),
        recipe: remapRecipe(row.recipe, orderProductMap),
        sections: optionalJson(row.sections),
        sectionIds: remapJsonIdArray(row.sectionIds, orderSectionMap),
        productType: String(row.productType ?? 'order'),
        isActive: row.isActive !== false,
        sortOrder: Number(row.sortOrder ?? 0),
        createdAt: ddate(row.createdAt),
        updatedAt: ddate(row.updatedAt),
      },
    });
  }

  for (const row of orders) {
    await tx.order.create({
      data: {
        id: mappedRequired(orderMap, row.id, 'order'),
        tenantId,
        companyId: newCompanyId,
        orderNumber: String(row.orderNumber),
        orderDate: ddate(row.orderDate),
        orderType: String(row.orderType),
        pettyCashAmount: row.pettyCashAmount != null ? dec(row.pettyCashAmount) : null,
        totalAmount: dec(row.totalAmount),
        notes: (row.notes as string | null) ?? null,
        sourceStaffOrderIds: remapJsonIdArray(row.sourceStaffOrderIds, staffOrderMap),
        status: String(row.status ?? 'active'),
        createdAt: ddate(row.createdAt),
        updatedAt: ddate(row.updatedAt),
      },
    });
  }

  for (const row of orderItems) {
    await tx.orderItem.create({
      data: {
        id: nid(),
        orderId: mappedRequired(orderMap, row.orderId, 'order item order'),
        productId: mappedRequired(orderProductMap, row.productId, 'order item product'),
        size: (row.size as string | null) ?? null,
        packaging: (row.packaging as string | null) ?? null,
        unit: (row.unit as string | null) ?? null,
        quantity: dec(row.quantity),
        quantityMultiplier: dec(row.quantityMultiplier ?? 1),
        inventoryBaseQuantitySnapshot: row.inventoryBaseQuantitySnapshot != null
          ? dec(row.inventoryBaseQuantitySnapshot)
          : null,
        unitPrice: dec(row.unitPrice),
        amount: dec(row.amount),
      },
    });
  }

  for (const row of staffOrders) {
    const purchaseOrderId = row.purchaseOrderId == null
      ? null
      : mappedRequired(orderMap, row.purchaseOrderId, 'staff order purchase order');
    await tx.staffOrder.create({
      data: {
        id: mappedRequired(staffOrderMap, row.id, 'staff order'),
        tenantId,
        companyId: newCompanyId,
        userId: restoredRequiredUserId(row.userId, existingUserIds, importingUserId),
        sectionName: String(row.sectionName),
        orderType: String(row.orderType ?? 'order'),
        entryType: String(row.entryType ?? 'issue'),
        status: String(row.status ?? 'pending'),
        logRef: (row.logRef as string | null) ?? null,
        saleDate: row.saleDate ? ddate(row.saleDate) : null,
        notes: (row.notes as string | null) ?? null,
        sentAt: row.sentAt ? ddate(row.sentAt) : null,
        purchaseOrderId,
        createdAt: ddate(row.createdAt),
        updatedAt: ddate(row.updatedAt),
      },
    });
  }

  for (const row of staffOrderItems) {
    await tx.staffOrderItem.create({
      data: {
        id: nid(),
        staffOrderId: mappedRequired(staffOrderMap, row.staffOrderId, 'staff order item order'),
        productId: mappedRequired(orderProductMap, row.productId, 'staff order item product'),
        quantity: dec(row.quantity),
        quantityMultiplier: dec(row.quantityMultiplier ?? 1),
        inventoryConsumptionSnapshot: remapConsumptionSnapshot(
          row.inventoryConsumptionSnapshot,
          orderProductMap,
        ),
        size: (row.size as string | null) ?? null,
        packaging: (row.packaging as string | null) ?? null,
        unit: (row.unit as string | null) ?? null,
        unitPrice: dec(row.unitPrice ?? 0),
        notes: (row.notes as string | null) ?? null,
        cancellationReasons: optionalJson(row.cancellationReasons),
        createdAt: ddate(row.createdAt),
      },
    });
  }

  for (const row of stocktakes) {
    await tx.inventoryStocktake.create({
      data: {
        id: mappedRequired(inventoryStocktakeMap, row.id, 'inventory stocktake'),
        tenantId,
        companyId: newCompanyId,
        stocktakeDate: ddate(row.stocktakeDate),
        status: String(row.status ?? 'approved'),
        notes: (row.notes as string | null) ?? null,
        createdByUserId: restoredOptionalUserId(
          row.createdByUserId,
          existingUserIds,
          importingUserId,
        ),
        createdAt: ddate(row.createdAt),
      },
    });
  }

  for (const row of stocktakeLines) {
    await tx.inventoryStocktakeLine.create({
      data: {
        id: nid(),
        tenantId,
        companyId: newCompanyId,
        stocktakeId: mappedRequired(
          inventoryStocktakeMap,
          row.stocktakeId,
          'inventory stocktake line stocktake',
        ),
        stocktakeDate: ddate(row.stocktakeDate),
        productId: mappedRequired(orderProductMap, row.productId, 'inventory stocktake line product'),
        unit: String(row.unit),
        expectedQuantity: dec(row.expectedQuantity),
        physicalQuantity: dec(row.physicalQuantity),
        varianceQuantity: dec(row.varianceQuantity),
      },
    });
  }

  for (const row of movements) {
    const id = nid();
    const productId = mappedRequired(orderProductMap, row.productId, 'inventory movement product');
    const stocktakeId = row.stocktakeId == null
      ? null
      : mappedRequired(inventoryStocktakeMap, row.stocktakeId, 'inventory movement stocktake');
    await tx.inventoryMovement.create({
      data: {
        id,
        tenantId,
        companyId: newCompanyId,
        productId,
        transactionDate: ddate(row.transactionDate),
        movementType: String(row.movementType),
        quantityBase: dec(row.quantityBase),
        stocktakeId,
        sourceKey: stocktakeId
          ? `inventory-stocktake:${stocktakeId}:${productId}`
          : `inventory-restore:${newCompanyId}:${id}`,
        notes: (row.notes as string | null) ?? null,
        createdByUserId: restoredOptionalUserId(
          row.createdByUserId,
          existingUserIds,
          importingUserId,
        ),
        createdAt: ddate(row.createdAt),
      },
    });
  }

  return {
    orderCategoryMap,
    orderSectionMap,
    orderConversionTemplateMap,
    orderProductMap,
    orderMap,
    staffOrderMap,
    inventoryStocktakeMap,
  };
}
