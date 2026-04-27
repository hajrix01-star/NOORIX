import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const UNASSIGNED = '__unassigned__';

/**
 * تفصيل وارد/صادر لكل خزنة حسب تخصيصات الفواتير (مبيعات vs غير مبيعات) + أرصدة فواتير legacy.
 */
export async function loadInvoiceListInflowByVault(
  prisma: TenantPrismaService,
  companyId: string,
  activeWhere: Prisma.InvoiceWhereInput,
) {
  const saleWhere: Prisma.InvoiceWhereInput = { AND: [activeWhere, { kind: 'sale' }] };
  const nonSaleWhere: Prisma.InvoiceWhereInput = { AND: [activeWhere, { kind: { not: 'sale' } }] };
  const [allocGroups, legacySaleInvoices, outflowAllocGroups, legacyOutflowInvoices] = await Promise.all([
    prisma.invoiceVaultAllocation.groupBy({
      by: ['vaultId'],
      where: { invoice: { is: saleWhere } },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { AND: [saleWhere, { vaultAllocations: { none: {} } }] },
      select: { vaultId: true, totalAmount: true },
    }),
    prisma.invoiceVaultAllocation.groupBy({
      by: ['vaultId'],
      where: { invoice: { is: nonSaleWhere } },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { AND: [nonSaleWhere, { vaultAllocations: { none: {} } }] },
      select: { vaultId: true, totalAmount: true },
    }),
  ]);

  const vaultTotals = new Map<string, Decimal>();
  for (const g of allocGroups) {
    const vid = g.vaultId;
    const amt = new Decimal(g._sum.amount ?? 0);
    vaultTotals.set(vid, (vaultTotals.get(vid) ?? new Decimal(0)).plus(amt));
  }
  for (const inv of legacySaleInvoices) {
    const amt = new Decimal(inv.totalAmount ?? 0);
    const key = inv.vaultId ?? UNASSIGNED;
    vaultTotals.set(key, (vaultTotals.get(key) ?? new Decimal(0)).plus(amt));
  }

  const outflowVaultTotals = new Map<string, Decimal>();
  for (const g of outflowAllocGroups) {
    const vid = g.vaultId;
    const amt = new Decimal(g._sum.amount ?? 0);
    outflowVaultTotals.set(vid, (outflowVaultTotals.get(vid) ?? new Decimal(0)).plus(amt));
  }
  for (const inv of legacyOutflowInvoices) {
    const amt = new Decimal(inv.totalAmount ?? 0);
    const key = inv.vaultId ?? UNASSIGNED;
    outflowVaultTotals.set(key, (outflowVaultTotals.get(key) ?? new Decimal(0)).plus(amt));
  }

  const allVaultKeys = new Set<string>([...vaultTotals.keys(), ...outflowVaultTotals.keys()]);
  const vaultIds = [...allVaultKeys].filter((id) => id !== UNASSIGNED);
  const vaultRows =
    vaultIds.length > 0
      ? await prisma.vault.findMany({
          where: { id: { in: vaultIds }, companyId },
          select: { id: true, nameAr: true, nameEn: true },
        })
      : [];
  const nameByVault = new Map(vaultRows.map((v) => [v.id, v]));
  return [...allVaultKeys]
    .map((vaultId) => {
      const inflow = vaultTotals.get(vaultId) ?? new Decimal(0);
      const outflow = outflowVaultTotals.get(vaultId) ?? new Decimal(0);
      const remainder = inflow.minus(outflow);
      if (vaultId === UNASSIGNED) {
        return {
          vaultId,
          nameAr: '',
          nameEn: '',
          total: inflow.toString(),
          outflow: outflow.toString(),
          remainder: remainder.toString(),
          unassigned: true,
        };
      }
      const meta = nameByVault.get(vaultId);
      return {
        vaultId,
        nameAr: meta?.nameAr ?? '',
        nameEn: meta?.nameEn ?? '',
        total: inflow.toString(),
        outflow: outflow.toString(),
        remainder: remainder.toString(),
      };
    })
    .sort((a, b) => {
      const volA = new Decimal(a.total).plus(a.outflow);
      const volB = new Decimal(b.total).plus(b.outflow);
      return volB.cmp(volA) || new Decimal(b.remainder).abs().cmp(new Decimal(a.remainder).abs());
    });
}
