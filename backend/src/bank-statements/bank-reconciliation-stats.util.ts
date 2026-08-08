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
    // Historical reconciliation must not change when a vault is later archived
    // or disabled. Include every company vault and classify its enduring account.
    where: { companyId },
  });
  const bankVaults = vaults.filter((vault) => vault.bankReconciliationEnabled);
  const bankVaultIds = new Set(bankVaults.map((v) => v.id));

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

  let cashDeposits = new Decimal(0);
  if (bankVaultIds.size > 0) {
    // Reconciliation is an operational report layered over the immutable
    // ledger. Read posted business vouchers, not raw reversal entries: a
    // reversed original and its correction voucher must not be presented as a
    // real bank deposit. The ledger remains untouched and drives balances.
    const transfers = await prisma.vaultTransfer.findMany({
      where: {
        companyId,
        reversalOfId: null,
        transactionDate: { gte: start, lte: end },
      },
      select: {
        amount: true,
        fromVaultId: true,
        toVaultId: true,
        status: true,
        reversal: { select: { transactionDate: true } },
      },
    });
    for (const e of transfers) {
      // Use the accounting date of the reversal voucher, never reversedAt
      // (which is only the entry timestamp). This preserves historical as-of
      // reports for backdated and future-dated corrections. A legacy reversed
      // voucher without a linked reversal is excluded fail-closed.
      if (e.status === 'reversed') {
        if (!e.reversal || e.reversal.transactionDate <= end) continue;
      } else if (e.status !== 'posted') {
        continue;
      }
      // Only a posted non-bank -> bank voucher is an expected bank credit.
      // bank/app -> bank/app merely relocates company funds.
      if (!bankVaultIds.has(e.toVaultId) || bankVaultIds.has(e.fromVaultId)) continue;
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
