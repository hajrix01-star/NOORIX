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

    const datePart: Prisma.DateTimeFilter | undefined = asOfDate
      ? { lte: asOfDate }
      : undefined;

    const debitWhere: Prisma.LedgerEntryWhereInput = {
      companyId: vault.companyId,
      status: 'active',
      debitAccountId: vault.accountId,
      ...(datePart ? { transactionDate: datePart } : {}),
    };
    const creditWhere: Prisma.LedgerEntryWhereInput = {
      companyId: vault.companyId,
      status: 'active',
      creditAccountId: vault.accountId,
      ...(datePart ? { transactionDate: datePart } : {}),
    };

    const [debitSum, creditSum] = await Promise.all([
      tx.ledgerEntry.aggregate({ where: debitWhere, _sum: { amount: true } }),
      tx.ledgerEntry.aggregate({ where: creditWhere, _sum: { amount: true } }),
    ]);

    const debit = new Prisma.Decimal(debitSum._sum.amount ?? 0);
    const credit = new Prisma.Decimal(creditSum._sum.amount ?? 0);
    return debit.minus(credit);
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

    const datePart: Prisma.DateTimeFilter | undefined = asOfDate
      ? { lte: asOfDate }
      : undefined;

    const result: Record<string, Prisma.Decimal> = {};

    for (const v of vaults) {
      const debitWhere: Prisma.LedgerEntryWhereInput = {
        companyId,
        status: 'active',
        debitAccountId: v.accountId,
        ...(datePart ? { transactionDate: datePart } : {}),
      };
      const creditWhere: Prisma.LedgerEntryWhereInput = {
        companyId,
        status: 'active',
        creditAccountId: v.accountId,
        ...(datePart ? { transactionDate: datePart } : {}),
      };
      const [debitSum, creditSum] = await Promise.all([
        tx.ledgerEntry.aggregate({ where: debitWhere, _sum: { amount: true } }),
        tx.ledgerEntry.aggregate({ where: creditWhere, _sum: { amount: true } }),
      ]);
      const debit = new Prisma.Decimal(debitSum._sum.amount ?? 0);
      const credit = new Prisma.Decimal(creditSum._sum.amount ?? 0);
      result[v.id] = debit.minus(credit);
    }
    return result;
  }
}
