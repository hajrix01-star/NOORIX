import { Prisma, type PrismaClient } from '@prisma/client';

/** فواتير صرف متعددة الخزن: مجموع التوزيعات يجب أن يطابق totalAmount */
export async function verifyImportedCompanyVaultAllocations(
  companyId: string,
  client: Pick<PrismaClient, 'invoice'>,
): Promise<string[]> {
  const kinds = ['purchase', 'expense', 'salary', 'advance', 'hr_expense', 'fixed_expense'];
  const eps = new Prisma.Decimal('0.0001');
  const invoices = await client.invoice.findMany({
    where: { companyId, status: 'active', kind: { in: kinds } },
    select: {
      invoiceNumber: true,
      kind: true,
      totalAmount: true,
      vaultAllocations: { select: { amount: true } },
    },
  });
  const warnings: string[] = [];
  for (const inv of invoices) {
    if (inv.vaultAllocations.length === 0) continue;
    const sum = inv.vaultAllocations.reduce((s, a) => s.plus(a.amount), new Prisma.Decimal(0));
    if (!sum.minus(inv.totalAmount).abs().lte(eps)) {
      warnings.push(
        `فاتورة ${inv.invoiceNumber} (${inv.kind}): مجموع التوزيعات ${sum.toFixed(4)} ≠ الإجمالي ${inv.totalAmount.toFixed(4)}`,
      );
    }
  }
  return warnings;
}
