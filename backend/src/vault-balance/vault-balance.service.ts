/**
 * VaultBalanceService — حساب رصيد الخزينة من القيود فقط
 *
 * القاعدة الذهبية: رصيد الخزينة يُحسب دائماً من LedgerEntry — لا يُخزّن أو يُحدّث يدوياً.
 * الخزينة (asset): المدين يزيدها، الدائن يقللها.
 * الرصيد = مجموع المبالغ (حيث debitAccountId = حساب الخزينة) - مجموع المبالغ (حيث creditAccountId = حساب الخزينة)
 */
import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { Prisma } from '@prisma/client';

type TxClient = Parameters<Parameters<TenantPrismaService['$transaction']>[0]>[0];

@Injectable()
export class VaultBalanceService {
  constructor(private readonly prisma: TenantPrismaService) {}

  /**
   * حساب رصيد خزينة معينة حتى تاريخ محدد (شامل).
   * يُستخدم فقط القيود النشطة (status = active).
   */
  async getVaultBalance(
    tx: TxClient,
    vaultId: string,
    asOfDate?: Date,
  ): Promise<Prisma.Decimal> {
    const vault = await tx.vault.findUnique({
      where: { id: vaultId },
      select: { accountId: true, companyId: true },
    });
    if (!vault) return new Prisma.Decimal(0);

    const where: Prisma.LedgerEntryWhereInput = {
      companyId: vault.companyId,
      status: 'active',
      OR: [{ debitAccountId: vault.accountId }, { creditAccountId: vault.accountId }],
    };

    if (asOfDate) {
      where.transactionDate = { lte: asOfDate };
    }

    const entries = await tx.ledgerEntry.findMany({
      where,
      select: { debitAccountId: true, creditAccountId: true, amount: true },
    });

    let balance = new Prisma.Decimal(0);
    for (const e of entries) {
      if (e.debitAccountId === vault.accountId) {
        balance = balance.plus(e.amount);
      } else {
        balance = balance.minus(e.amount);
      }
    }
    return balance;
  }

  /**
   * حساب أرصدة جميع الخزائن النشطة لشركة.
   */
  async getCompanyVaultBalances(
    tx: TxClient,
    companyId: string,
    asOfDate?: Date,
  ): Promise<Record<string, Prisma.Decimal>> {
    const vaults = await tx.vault.findMany({
      where: { companyId, isActive: true, isArchived: false },
      select: { id: true, accountId: true },
    });

    const result: Record<string, Prisma.Decimal> = {};

    for (const v of vaults) {
      const where: Prisma.LedgerEntryWhereInput = {
        companyId,
        status: 'active',
        OR: [{ debitAccountId: v.accountId }, { creditAccountId: v.accountId }],
      };
      if (asOfDate) where.transactionDate = { lte: asOfDate };

      const entries = await tx.ledgerEntry.findMany({
        where,
        select: { debitAccountId: true, amount: true },
      });

      let balance = new Prisma.Decimal(0);
      for (const e of entries) {
        if (e.debitAccountId === v.accountId) {
          balance = balance.plus(e.amount);
        } else {
          balance = balance.minus(e.amount);
        }
      }
      result[v.id] = balance;
    }
    return result;
  }
}
