import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import {
  calculateOrdersV4Issue,
  calculateOrdersV4Receipt,
  calculateOrdersV4Reversal,
  calculateOrdersV4UnitRebase,
} from './orders-v4-calculation.kernel';
import type { OrdersV4InventoryCalculation, OrdersV4ResolvedConversion } from './orders-v4-kernel.types';
import type { OrdersV4InventoryBalance } from './orders-v4-kernel.types';

type OrdersV4Transaction = Prisma.TransactionClient;

@Injectable()
export class OrdersV4LedgerPostingService {
  async lockKeys(
    tx: OrdersV4Transaction,
    companyId: string,
    keys: Array<{ itemId: string; locationId: string }>,
  ): Promise<void> {
    const unique = [...new Set(keys.map((key) => `${key.itemId}:${key.locationId}`))].sort();
    for (const key of unique) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:ledger:${companyId}:${key}`}))`;
    }
  }

  async postReceipt(tx: OrdersV4Transaction, input: {
    tenantId: string; companyId: string; itemId: string; locationId: string; documentLineId: string;
    inventoryUnitId: string;
    sourceId: string; sourceKey: string; effectiveAt: Date; quantity: Prisma.Decimal; totalValue: Prisma.Decimal;
    conversionVersionId: string | null; sourceSnapshot: Prisma.InputJsonObject;
  }) {
    await this.lockKeys(tx, input.companyId, [{ itemId: input.itemId, locationId: input.locationId }]);
    const balance = await this.currentBalance(tx, input.companyId, input.itemId, input.locationId, input.inventoryUnitId);
    const calculation = calculateOrdersV4Receipt(balance, { quantity: input.quantity, totalValue: input.totalValue });
    return tx.ordersV4InventoryLedgerEntry.create({
      data: {
        tenantId: input.tenantId, companyId: input.companyId, itemId: input.itemId, inventoryUnitId: input.inventoryUnitId, locationId: input.locationId,
        documentLineId: input.documentLineId, effectiveAt: input.effectiveAt, entryType: 'receipt',
        ...calculation, sourceType: 'purchase_document', sourceId: input.sourceId, sourceKey: input.sourceKey,
        sourceSnapshot: input.sourceSnapshot, conversionVersionId: input.conversionVersionId,
        createdByUserId: TenantContext.getUserId(),
      },
    });
  }

  async postIssue(tx: OrdersV4Transaction, input: {
    tenantId: string; companyId: string; itemId: string; locationId: string; documentLineId: string;
    inventoryUnitId: string;
    sourceId: string; sourceKey: string; effectiveAt: Date; quantity: Prisma.Decimal;
    conversionVersionId: string | null; recipeVersionId: string | null; sourceSnapshot: Prisma.InputJsonObject;
  }) {
    await this.lockKeys(tx, input.companyId, [{ itemId: input.itemId, locationId: input.locationId }]);
    const balance = await this.currentBalance(tx, input.companyId, input.itemId, input.locationId, input.inventoryUnitId);
    const calculation = calculateOrdersV4Issue(balance, { quantity: input.quantity });
    return tx.ordersV4InventoryLedgerEntry.create({
      data: {
        tenantId: input.tenantId, companyId: input.companyId, itemId: input.itemId, inventoryUnitId: input.inventoryUnitId, locationId: input.locationId,
        documentLineId: input.documentLineId, effectiveAt: input.effectiveAt, entryType: 'issue',
        ...calculation, sourceType: 'registration_document', sourceId: input.sourceId, sourceKey: input.sourceKey,
        sourceSnapshot: input.sourceSnapshot, conversionVersionId: input.conversionVersionId,
        recipeVersionId: input.recipeVersionId, createdByUserId: TenantContext.getUserId(),
      },
    });
  }

  async postStocktakeAdjustment(tx: OrdersV4Transaction, input: {
    tenantId: string; companyId: string; itemId: string; inventoryUnitId: string; locationId: string;
    stocktakeId: string; stocktakeLineId: string; effectiveAt: Date; calculation: OrdersV4InventoryCalculation;
    stocktakeNumber: string;
  }) {
    await this.lockKeys(tx, input.companyId, [{ itemId: input.itemId, locationId: input.locationId }]);
    if (input.calculation.quantityDelta.isZero()) return null;
    const entry = await tx.ordersV4InventoryLedgerEntry.create({
      data: {
        tenantId: input.tenantId, companyId: input.companyId, itemId: input.itemId,
        inventoryUnitId: input.inventoryUnitId, locationId: input.locationId,
        effectiveAt: input.effectiveAt, entryType: 'stocktake_adjustment', ...input.calculation,
        sourceType: 'stocktake', sourceId: input.stocktakeId,
        sourceKey: `stocktake:${input.stocktakeId}:line:${input.stocktakeLineId}`,
        sourceSnapshot: { kernelVersion: 4, stocktakeNumber: input.stocktakeNumber, stocktakeLineId: input.stocktakeLineId },
        createdByUserId: TenantContext.getUserId(),
      },
    });
    return entry;
  }

  async postReversal(tx: OrdersV4Transaction, input: {
    tenantId: string; companyId: string; sourceId: string; effectiveAt: Date;
    currentInventoryUnitId: string; currentConversionVersionId: string | null;
    currentConversion: OrdersV4ResolvedConversion;
    original: {
      id: string; itemId: string; inventoryUnitId: string; locationId: string;
      quantityDelta: Prisma.Decimal; valueDelta: Prisma.Decimal; unitCost: Prisma.Decimal;
      conversionVersionId: string | null; recipeVersionId: string | null;
    };
  }) {
    const { original } = input;
    await this.lockKeys(tx, input.companyId, [{ itemId: original.itemId, locationId: original.locationId }]);
    const balance = await this.currentBalance(tx, input.companyId, original.itemId, original.locationId, input.currentInventoryUnitId);
    const calculation = calculateOrdersV4Reversal(balance, original, input.currentConversion.factor);
    return tx.ordersV4InventoryLedgerEntry.create({
      data: {
        tenantId: input.tenantId, companyId: input.companyId, itemId: original.itemId,
        inventoryUnitId: input.currentInventoryUnitId, locationId: original.locationId,
        effectiveAt: input.effectiveAt, entryType: 'reversal', ...calculation,
        sourceType: 'document_reversal', sourceId: input.sourceId, sourceKey: `reversal:${original.id}`,
        sourceSnapshot: {
          kernelVersion: 4, originalEntryId: original.id, originalInventoryUnitId: original.inventoryUnitId,
          currentInventoryUnitId: input.currentInventoryUnitId, conversionFactor: input.currentConversion.factor.toString(),
        },
        conversionVersionId: input.currentConversionVersionId, recipeVersionId: original.recipeVersionId,
        reversalOfId: original.id, createdByUserId: TenantContext.getUserId(),
      },
    });
  }

  async postUnitRebase(tx: OrdersV4Transaction, input: {
    tenantId: string; companyId: string; itemId: string; locationId: string; effectiveAt: Date;
    oldInventoryUnitId: string; newInventoryUnitId: string; conversionVersionId: string | null;
    conversion: OrdersV4ResolvedConversion;
  }) {
    await this.lockKeys(tx, input.companyId, [{ itemId: input.itemId, locationId: input.locationId }]);
    const balance = await this.currentBalance(tx, input.companyId, input.itemId, input.locationId, input.oldInventoryUnitId);
    const calculation = calculateOrdersV4UnitRebase(balance, input.conversion);
    return tx.ordersV4InventoryLedgerEntry.create({
      data: {
        tenantId: input.tenantId, companyId: input.companyId, itemId: input.itemId,
        inventoryUnitId: input.newInventoryUnitId, locationId: input.locationId,
        effectiveAt: input.effectiveAt, entryType: 'unit_rebase', ...calculation,
        sourceType: 'inventory_unit_change', sourceId: input.itemId,
        sourceKey: `unit-rebase:${input.itemId}:${input.locationId}:conversion:${input.conversionVersionId || input.newInventoryUnitId}`,
        sourceSnapshot: {
          kernelVersion: 4, oldInventoryUnitId: input.oldInventoryUnitId,
          newInventoryUnitId: input.newInventoryUnitId, conversionFactor: input.conversion.factor.toString(),
          oldQuantity: balance.quantity.toString(),
        },
        conversionVersionId: input.conversionVersionId, createdByUserId: TenantContext.getUserId(),
      },
    });
  }

  async currentBalance(
    tx: OrdersV4Transaction,
    companyId: string,
    itemId: string,
    locationId: string,
    expectedInventoryUnitId?: string,
  ): Promise<OrdersV4InventoryBalance> {
    const latest = await tx.ordersV4InventoryLedgerEntry.findFirst({
      where: { companyId, itemId, locationId }, orderBy: { sequence: 'desc' },
    });
    if (latest && expectedInventoryUnitId && latest.inventoryUnitId !== expectedInventoryUnitId) {
      throw new Error(`Orders V4 inventory unit mismatch for ${itemId}/${locationId}`);
    }
    return {
      quantity: latest?.quantityAfter ?? new Prisma.Decimal(0),
      value: latest?.valueAfter ?? new Prisma.Decimal(0),
      averageUnitCost: latest?.averageUnitCostAfter ?? new Prisma.Decimal(0),
    };
  }
}

