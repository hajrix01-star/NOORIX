import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { calculateOrdersV4Issue, calculateOrdersV4Receipt } from './orders-v4-calculation.kernel';
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
    sourceId: string; sourceKey: string; effectiveAt: Date; quantity: Prisma.Decimal; totalValue: Prisma.Decimal;
    conversionVersionId: string | null; sourceSnapshot: Prisma.InputJsonObject;
  }) {
    await this.lockKeys(tx, input.companyId, [{ itemId: input.itemId, locationId: input.locationId }]);
    const balance = await this.currentBalance(tx, input.companyId, input.itemId, input.locationId);
    const calculation = calculateOrdersV4Receipt(balance, { quantity: input.quantity, totalValue: input.totalValue });
    return tx.ordersV4InventoryLedgerEntry.create({
      data: {
        tenantId: input.tenantId, companyId: input.companyId, itemId: input.itemId, locationId: input.locationId,
        documentLineId: input.documentLineId, effectiveAt: input.effectiveAt, entryType: 'receipt',
        ...calculation, sourceType: 'purchase_document', sourceId: input.sourceId, sourceKey: input.sourceKey,
        sourceSnapshot: input.sourceSnapshot, conversionVersionId: input.conversionVersionId,
        createdByUserId: TenantContext.getUserId(),
      },
    });
  }

  async postIssue(tx: OrdersV4Transaction, input: {
    tenantId: string; companyId: string; itemId: string; locationId: string; documentLineId: string;
    sourceId: string; sourceKey: string; effectiveAt: Date; quantity: Prisma.Decimal;
    conversionVersionId: string | null; recipeVersionId: string | null; sourceSnapshot: Prisma.InputJsonObject;
  }) {
    await this.lockKeys(tx, input.companyId, [{ itemId: input.itemId, locationId: input.locationId }]);
    const balance = await this.currentBalance(tx, input.companyId, input.itemId, input.locationId);
    const calculation = calculateOrdersV4Issue(balance, { quantity: input.quantity });
    return tx.ordersV4InventoryLedgerEntry.create({
      data: {
        tenantId: input.tenantId, companyId: input.companyId, itemId: input.itemId, locationId: input.locationId,
        documentLineId: input.documentLineId, effectiveAt: input.effectiveAt, entryType: 'issue',
        ...calculation, sourceType: 'registration_document', sourceId: input.sourceId, sourceKey: input.sourceKey,
        sourceSnapshot: input.sourceSnapshot, conversionVersionId: input.conversionVersionId,
        recipeVersionId: input.recipeVersionId, createdByUserId: TenantContext.getUserId(),
      },
    });
  }

  private async currentBalance(tx: OrdersV4Transaction, companyId: string, itemId: string, locationId: string): Promise<OrdersV4InventoryBalance> {
    const latest = await tx.ordersV4InventoryLedgerEntry.findFirst({
      where: { companyId, itemId, locationId }, orderBy: { sequence: 'desc' },
    });
    return {
      quantity: latest?.quantityAfter ?? new Prisma.Decimal(0),
      value: latest?.valueAfter ?? new Prisma.Decimal(0),
      averageUnitCost: latest?.averageUnitCostAfter ?? new Prisma.Decimal(0),
    };
  }
}

