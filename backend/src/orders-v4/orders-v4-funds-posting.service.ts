import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import {
  calculateOrdersV4CustodyFunding,
  calculateOrdersV4CustodyPurchase,
  calculateOrdersV4FundsReversal,
} from './orders-v4-funds.kernel';

type OrdersV4Transaction = Prisma.TransactionClient;

@Injectable()
export class OrdersV4FundsPostingService {
  private async lock(tx: OrdersV4Transaction, companyId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:custody:${companyId}`}))`;
  }

  private async currentBalance(tx: OrdersV4Transaction, companyId: string): Promise<Prisma.Decimal> {
    const latest = await tx.ordersV4CustodyLedgerEntry.findFirst({
      where: { companyId },
      orderBy: { sequence: 'desc' },
      select: { balanceAfter: true },
    });
    return latest?.balanceAfter ?? new Prisma.Decimal(0);
  }

  async postPurchase(tx: OrdersV4Transaction, input: {
    tenantId: string;
    companyId: string;
    documentId: string;
    effectiveAt: Date;
    purchaseAmount: Prisma.Decimal;
    fundingAmount?: Prisma.Decimal | null;
  }): Promise<void> {
    await this.lock(tx, input.companyId);
    let balance = await this.currentBalance(tx, input.companyId);
    if (input.fundingAmount?.gt(0)) {
      const funding = calculateOrdersV4CustodyFunding(balance, input.fundingAmount);
      await tx.ordersV4CustodyLedgerEntry.create({
        data: {
          tenantId: input.tenantId, companyId: input.companyId, documentId: input.documentId,
          effectiveAt: input.effectiveAt, entryType: 'funding', ...funding,
          sourceKey: `document:${input.documentId}:custody:funding`,
          sourceSnapshot: { kernelVersion: 4, owner: 'orders-v4-funds-kernel' },
          createdByUserId: TenantContext.getUserId(),
        },
      });
      balance = funding.balanceAfter;
    }
    const purchase = calculateOrdersV4CustodyPurchase(balance, input.purchaseAmount);
    await tx.ordersV4CustodyLedgerEntry.create({
      data: {
        tenantId: input.tenantId, companyId: input.companyId, documentId: input.documentId,
        effectiveAt: input.effectiveAt, entryType: 'purchase', ...purchase,
        sourceKey: `document:${input.documentId}:custody:purchase`,
        sourceSnapshot: { kernelVersion: 4, owner: 'orders-v4-funds-kernel' },
        createdByUserId: TenantContext.getUserId(),
      },
    });
  }

  async postReversals(tx: OrdersV4Transaction, input: {
    tenantId: string;
    companyId: string;
    reversalDocumentId: string;
    effectiveAt: Date;
    originals: Array<{ id: string; amountDelta: Prisma.Decimal }>;
  }): Promise<void> {
    if (!input.originals.length) return;
    await this.lock(tx, input.companyId);
    let balance = await this.currentBalance(tx, input.companyId);
    for (const original of input.originals) {
      const reversal = calculateOrdersV4FundsReversal(balance, original.amountDelta);
      await tx.ordersV4CustodyLedgerEntry.create({
        data: {
          tenantId: input.tenantId, companyId: input.companyId,
          documentId: input.reversalDocumentId, effectiveAt: input.effectiveAt,
          entryType: 'reversal', ...reversal, sourceKey: `reversal:${original.id}`,
          sourceSnapshot: { kernelVersion: 4, owner: 'orders-v4-funds-kernel', originalEntryId: original.id },
          reversalOfId: original.id, createdByUserId: TenantContext.getUserId(),
        },
      });
      balance = reversal.balanceAfter;
    }
  }
}
