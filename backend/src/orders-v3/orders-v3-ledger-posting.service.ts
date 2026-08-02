import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { calculateOrdersV3Issue, calculateOrdersV3Receipt } from './orders-v3-calculation.kernel';
import type { OrdersV3InventoryBalance } from './orders-v3-kernel.types';

type OrdersV3Transaction = Prisma.TransactionClient;

@Injectable()
export class OrdersV3LedgerPostingService {
  async lockKeys(
    tx: OrdersV3Transaction,
    companyId: string,
    keys: Array<{ itemId: string; locationId: string }>,
  ): Promise<void> {
    const unique = [...new Set(keys.map((key) => `${key.itemId}:${key.locationId}`))].sort();
    for (const key of unique) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v3:ledger:${companyId}:${key}`}))`;
    }
  }

  async postReceipt(tx: OrdersV3Transaction, input: {
    tenantId: string; companyId: string; itemId: string; locationId: string; documentLineId: string;
    sourceId: string; sourceKey: string; effectiveAt: Date; quantity: Prisma.Decimal; totalValue: Prisma.Decimal;
    conversionVersionId: string | null; sourceSnapshot: Prisma.InputJsonObject;
  }) {
    await this.lockKeys(tx, input.companyId, [{ itemId: input.itemId, locationId: input.locationId }]);
    const balance = await this.currentBalance(tx, input.companyId, input.itemId, input.locationId);
    const calculation = calculateOrdersV3Receipt(balance, { quantity: input.quantity, totalValue: input.totalValue });
    return tx.ordersV3LedgerEntry.create({
      data: {
        tenantId: input.tenantId, companyId: input.companyId, itemId: input.itemId, locationId: input.locationId,
        documentLineId: input.documentLineId, effectiveAt: input.effectiveAt, entryType: 'receipt',
        ...calculation, sourceType: 'purchase_document', sourceId: input.sourceId, sourceKey: input.sourceKey,
        sourceSnapshot: input.sourceSnapshot, conversionVersionId: input.conversionVersionId,
        createdByUserId: TenantContext.getUserId(),
      },
    });
  }

  async postIssue(tx: OrdersV3Transaction, input: {
    tenantId: string; companyId: string; itemId: string; locationId: string; documentLineId: string;
    sourceId: string; sourceKey: string; effectiveAt: Date; quantity: Prisma.Decimal;
    conversionVersionId: string | null; recipeVersionId: string | null; sourceSnapshot: Prisma.InputJsonObject;
  }) {
    await this.lockKeys(tx, input.companyId, [{ itemId: input.itemId, locationId: input.locationId }]);
    const balance = await this.currentBalance(tx, input.companyId, input.itemId, input.locationId);
    const calculation = calculateOrdersV3Issue(balance, { quantity: input.quantity });
    return tx.ordersV3LedgerEntry.create({
      data: {
        tenantId: input.tenantId, companyId: input.companyId, itemId: input.itemId, locationId: input.locationId,
        documentLineId: input.documentLineId, effectiveAt: input.effectiveAt, entryType: 'issue',
        ...calculation, sourceType: 'registration_document', sourceId: input.sourceId, sourceKey: input.sourceKey,
        sourceSnapshot: input.sourceSnapshot, conversionVersionId: input.conversionVersionId,
        recipeVersionId: input.recipeVersionId, createdByUserId: TenantContext.getUserId(),
      },
    });
  }

  private async currentBalance(tx: OrdersV3Transaction, companyId: string, itemId: string, locationId: string): Promise<OrdersV3InventoryBalance> {
    const latest = await tx.ordersV3LedgerEntry.findFirst({
      where: { companyId, itemId, locationId }, orderBy: { sequence: 'desc' },
    });
    return {
      quantity: latest?.quantityAfter ?? new Prisma.Decimal(0),
      value: latest?.valueAfter ?? new Prisma.Decimal(0),
      averageUnitCost: latest?.averageUnitCostAfter ?? new Prisma.Decimal(0),
    };
  }
}
