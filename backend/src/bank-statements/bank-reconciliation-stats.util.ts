import { Decimal } from '@prisma/client/runtime/library';
import { toYmd } from '../common/utils/to-ymd.util';
import type { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * تسوية مبيعات الخزائن «البنكية» مقابل إيداعات الكشف/النظام — نطاق تاريخ.
 */
export async function computeBankReconciliationStats(
  prisma: TenantPrismaService,
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<{
  system_data: {
    sales_bank_total: number;
    cash_deposits_total: number;
    expected_credits: number;
    sale_invoice_count: number;
  };
}> {
  const start = new Date(`${toYmd(startDate)}T00:00:00.000Z`);
  const end = new Date(`${toYmd(endDate)}T23:59:59.999Z`);

  const vaults = await prisma.vault.findMany({
    where: { companyId, isActive: true, isArchived: false },
  });
  const bankVaultIds = new Set(
    vaults
      .filter((v) => {
        const t = (v.type || '').toLowerCase();
        const n = `${v.nameAr} ${v.nameEn || ''}`.toLowerCase();
        const pm = (v.paymentMethod || '').toLowerCase();
        return (
          t === 'bank' ||
          t === 'app' ||
          n.includes('بنك') ||
          n.includes('bank') ||
          n.includes('مدى') ||
          n.includes('mada') ||
          n.includes('شبكة') ||
          pm.includes('مدى') ||
          pm.includes('mada') ||
          pm.includes('بنك')
        );
      })
      .map((v) => v.id),
  );

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      kind: 'sale',
      status: 'active',
      transactionDate: { gte: start, lte: end },
    },
    select: { totalAmount: true, vaultId: true },
  });

  let totalBankSales = new Decimal(0);
  let saleCount = 0;
  for (const inv of invoices) {
    if (!inv.vaultId || !bankVaultIds.has(inv.vaultId)) continue;
    totalBankSales = totalBankSales.add(new Decimal(inv.totalAmount?.toString() ?? '0'));
    saleCount += 1;
  }

  const bankIds = [...bankVaultIds];
  let cashDeposits = new Decimal(0);
  if (bankIds.length > 0) {
    const transfers = await prisma.ledgerEntry.findMany({
      where: {
        companyId,
        status: 'active',
        referenceType: 'transfer',
        transactionDate: { gte: start, lte: end },
        vaultId: { in: bankIds },
      },
      select: { amount: true },
    });
    for (const e of transfers) {
      cashDeposits = cashDeposits.add(new Decimal(e.amount?.toString() ?? '0'));
    }
  }

  const expectedCredits = totalBankSales.add(cashDeposits);

  return {
    system_data: {
      sales_bank_total: totalBankSales.toNumber(),
      cash_deposits_total: cashDeposits.toNumber(),
      expected_credits: expectedCredits.toNumber(),
      sale_invoice_count: saleCount,
    },
  };
}
