import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import {
  calculateOrdersV4Issue,
  calculateOrdersV4InventoryUnitPrice,
  calculateOrdersV4NegativeStockRevaluation,
  calculateOrdersV4OpeningBalance,
  calculateOrdersV4Receipt,
  calculateOrdersV4Reversal,
  calculateOrdersV4StocktakeAdjustment,
  calculateOrdersV4UnitRebase,
} from './orders-v4-calculation.kernel';
import type { OrdersV4ResolvedConversion } from './orders-v4-kernel.types';
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
    let balance = await this.currentBalance(tx, input.companyId, input.itemId, input.locationId, input.inventoryUnitId);
    const incomingUnitCost = calculateOrdersV4InventoryUnitPrice(input.totalValue, input.quantity);
    const revaluation = calculateOrdersV4NegativeStockRevaluation(balance, incomingUnitCost);
    if (revaluation) {
      await tx.ordersV4InventoryLedgerEntry.create({
        data: {
          tenantId: input.tenantId, companyId: input.companyId, itemId: input.itemId,
          inventoryUnitId: input.inventoryUnitId, locationId: input.locationId,
          documentLineId: input.documentLineId, effectiveAt: input.effectiveAt,
          entryType: 'negative_stock_revaluation', ...revaluation,
          sourceType: 'negative_stock_policy', sourceId: input.sourceId,
          sourceKey: `${input.sourceKey}:negative-stock-revaluation`,
          sourceSnapshot: {
            kernelVersion: 4,
            policy: 'revalue-negative-balance-at-next-receipt-cost',
            incomingUnitCost: incomingUnitCost.toString(),
            receiptSourceSnapshot: input.sourceSnapshot,
          },
          conversionVersionId: input.conversionVersionId,
          createdByUserId: TenantContext.getUserId(),
        },
      });
      balance = {
        quantity: revaluation.quantityAfter,
        value: revaluation.valueAfter,
        averageUnitCost: revaluation.averageUnitCostAfter,
      };
    }
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

  async postCutoverOpening(tx: OrdersV4Transaction, input: {
    tenantId: string; companyId: string; itemId: string; inventoryUnitId: string; locationId: string;
    sourceId: string; sourceKey: string; effectiveAt: Date;
    quantity: Prisma.Decimal.Value; value: Prisma.Decimal.Value; sourceSnapshot: Prisma.InputJsonObject;
  }) {
    await this.lockKeys(tx, input.companyId, [{ itemId: input.itemId, locationId: input.locationId }]);
    const balance = await this.currentBalance(tx, input.companyId, input.itemId, input.locationId, input.inventoryUnitId);
    if (!balance.quantity.isZero() || !balance.value.isZero()) {
      throw new Error(`Orders V4 cutover opening requires an empty balance for ${input.itemId}/${input.locationId}`);
    }
    const calculation = calculateOrdersV4OpeningBalance({ quantity: input.quantity, value: input.value });
    return tx.ordersV4InventoryLedgerEntry.create({
      data: {
        tenantId: input.tenantId, companyId: input.companyId, itemId: input.itemId,
        inventoryUnitId: input.inventoryUnitId, locationId: input.locationId,
        effectiveAt: input.effectiveAt, entryType: 'cutover_opening', ...calculation,
        sourceType: 'legacy_orders_cutover', sourceId: input.sourceId, sourceKey: input.sourceKey,
        sourceSnapshot: input.sourceSnapshot, createdByUserId: TenantContext.getUserId(),
      },
    });
  }

  async postIssue(tx: OrdersV4Transaction, input: {
    tenantId: string; companyId: string; itemId: string; locationId: string; documentLineId: string;
    inventoryUnitId: string;
    sourceId: string; sourceKey: string; effectiveAt: Date; quantity: Prisma.Decimal;
    provisionalUnitCost?: Prisma.Decimal;
    conversionVersionId: string | null; recipeVersionId: string | null; sourceSnapshot: Prisma.InputJsonObject;
  }) {
    await this.lockKeys(tx, input.companyId, [{ itemId: input.itemId, locationId: input.locationId }]);
    const balance = await this.currentBalance(tx, input.companyId, input.itemId, input.locationId, input.inventoryUnitId);
    const calculation = calculateOrdersV4Issue(balance, {
      quantity: input.quantity,
      provisionalUnitCost: input.provisionalUnitCost,
    });
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
    stocktakeId: string; effectiveAt: Date; physicalQuantity: Prisma.Decimal.Value; stocktakeNumber: string;
  }) {
    await this.lockKeys(tx, input.companyId, [{ itemId: input.itemId, locationId: input.locationId }]);
    const balance = await this.currentBalance(tx, input.companyId, input.itemId, input.locationId, input.inventoryUnitId);
    const calculation = calculateOrdersV4StocktakeAdjustment(balance, input.physicalQuantity);
    const stocktakeLine = await tx.ordersV4StocktakeLine.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        stocktakeId: input.stocktakeId,
        itemId: input.itemId,
        unitId: input.inventoryUnitId,
        expectedQuantity: balance.quantity,
        physicalQuantity: calculation.quantityAfter,
        varianceQuantity: calculation.quantityDelta,
        unitCost: calculation.unitCost,
        varianceValue: calculation.valueDelta,
      },
    });
    if (calculation.quantityDelta.isZero()) return { stocktakeLine, entry: null, calculation };
    const entry = await tx.ordersV4InventoryLedgerEntry.create({
      data: {
        tenantId: input.tenantId, companyId: input.companyId, itemId: input.itemId,
        inventoryUnitId: input.inventoryUnitId, locationId: input.locationId,
        effectiveAt: input.effectiveAt, entryType: 'stocktake_adjustment', ...calculation,
        sourceType: 'stocktake', sourceId: input.stocktakeId,
        sourceKey: `stocktake:${input.stocktakeId}:line:${stocktakeLine.id}`,
        sourceSnapshot: { kernelVersion: 4, stocktakeNumber: input.stocktakeNumber, stocktakeLineId: stocktakeLine.id },
        createdByUserId: TenantContext.getUserId(),
      },
    });
    return { stocktakeLine, entry, calculation };
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

