import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { VaultsService } from '../vaults/vaults.service';
import { rollupKindAggForDayClose } from './invoice-kind-rollup.util';
import { buildInvoiceTransactionDateFilter } from './invoice-transaction-date-filter.util';

const MAX_INVOICES = 2000;

/** اليوم التقويمي السابق لـ YMD بتوقيت UTC (مطابق منطق الفلاتر في التقرير). */
function ymdUtcPrevDay(ymd: string): string {
  const [y, mo, day] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, day));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * تقرير نهاية اليوم — ملخص مالي مضغوط ليوم واحد: فواتير، مبيعات يومية، خزائن، تحويلات.
 */
export async function loadInvoiceDayCloseReport(
  prisma: TenantPrismaService,
  vaultsService: VaultsService,
  companyId: string,
  dateStr: string,
) {
  if (!companyId?.trim()) throw new BadRequestException('companyId مطلوب');
  const d = toYmd(dateStr || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new BadRequestException('date مطلوب بصيغة YYYY-MM-DD');
  }

  const dateFilter = buildInvoiceTransactionDateFilter(d, d);
  const activeDayWhere = { companyId, status: 'active' as const, ...dateFilter };

  const [yStr, mStr] = d.split('-');
  const monthStartYmd = `${yStr}-${mStr}-01`;
  const dayBeforeReportMonth = ymdUtcPrevDay(monthStartYmd);

  const [byKindRows, invoiceCountAll, invoices, salesSummaries, vaultsAsOf, vaultsBeforeMonth, vaultsDay, transferAgg] = await Promise.all([
    prisma.invoice.groupBy({
      by: ['kind'],
      where: activeDayWhere,
      _sum: { netAmount: true, taxAmount: true, totalAmount: true },
      _count: { _all: true },
    }),
    prisma.invoice.count({ where: { companyId, ...dateFilter } }),
    prisma.invoice.findMany({
      where: { companyId, ...dateFilter },
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
      take: MAX_INVOICES + 1,
      include: {
        supplier: { select: { nameAr: true, nameEn: true } },
        employee: { select: { id: true, name: true, nameEn: true } },
        expenseLine: { select: { id: true, nameAr: true, nameEn: true, kind: true } },
        vault: { select: { id: true, nameAr: true, nameEn: true, type: true, paymentMethod: true } },
        vaultAllocations: {
          include: {
            vault: { select: { id: true, nameAr: true, nameEn: true, type: true, paymentMethod: true } },
          },
        },
      },
    }),
    prisma.dailySalesSummary.findMany({
      where: { companyId, status: 'active', ...dateFilter },
      include: {
        channels: { include: { vault: { select: { nameAr: true, nameEn: true, type: true } } } },
      },
      orderBy: { summaryNumber: 'asc' },
    }),
    vaultsService.getBalancesAsOf(companyId, d),
    vaultsService.getBalancesAsOf(companyId, dayBeforeReportMonth),
    vaultsService.findAll(companyId, false, d, d),
    prisma.ledgerEntry.aggregate({
      where: { companyId, status: 'active', referenceType: 'transfer', ...dateFilter },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const invoicesTruncated = invoices.length > MAX_INVOICES;
  const invoiceRows = invoicesTruncated ? invoices.slice(0, MAX_INVOICES) : invoices;

  const { sums, sumsByKind: byKind } = rollupKindAggForDayClose(byKindRows);

  type VaultPayAgg = { vaultId: string; nameAr: string; nameEn: string | null; total: Decimal };
  const payByVault = new Map<string, VaultPayAgg>();
  const addVaultPay = (vault: { id: string; nameAr: string; nameEn: string | null | undefined }, amountStr: string) => {
    const cur = payByVault.get(vault.id);
    const amt = new Decimal(amountStr);
    if (cur) {
      cur.total = cur.total.plus(amt);
    } else {
      payByVault.set(vault.id, {
        vaultId: vault.id,
        nameAr: vault.nameAr,
        nameEn: vault.nameEn ?? null,
        total: amt,
      });
    }
  };
  for (const inv of invoiceRows) {
    if (inv.status !== 'active') continue;
    if (inv.kind === 'sale') continue;
    const alloc = inv.vaultAllocations ?? [];
    if (alloc.length > 0) {
      for (const a of alloc) {
        if (a.vault) addVaultPay(a.vault, a.amount.toString());
      }
      continue;
    }
    if (inv.vault) addVaultPay(inv.vault, inv.totalAmount.toString());
  }
  const outflowByPaymentMethod = [...payByVault.values()]
    .map((r) => ({
      vaultId: r.vaultId,
      nameAr: r.nameAr,
      nameEn: r.nameEn,
      total: r.total.toFixed(4),
    }))
    .sort((a, b) => new Decimal(b.total).cmp(a.total));

  const vaultsDayLite = vaultsDay.map((v) => ({
    id: v.id,
    nameAr: v.nameAr,
    nameEn: v.nameEn ?? null,
    type: v.type,
    totalIn: v.totalIn,
    totalOut: v.totalOut,
    netDay: new Decimal(v.totalIn).minus(v.totalOut).toNumber(),
  }));

  const cashVaultsDay = vaultsDay.filter((v) => v.type === 'cash');
  const cashVaultsAsOf = vaultsAsOf.filter((v) => v.type === 'cash');
  const cashVaultsBeforeMonth = vaultsBeforeMonth.filter((v) => v.type === 'cash');
  const cashDayIn = cashVaultsDay.reduce((s, v) => s.plus(v.totalIn), new Decimal(0)).toNumber();
  const cashDayOut = cashVaultsDay.reduce((s, v) => s.plus(v.totalOut), new Decimal(0)).toNumber();
  const cashBalanceEod = cashVaultsAsOf.reduce((s, v) => s.plus(v.balance), new Decimal(0)).toNumber();
  const cashBalanceBeforeReportMonth = cashVaultsBeforeMonth.reduce((s, v) => s.plus(v.balance), new Decimal(0)).toNumber();
  /** صافي حركة خزائن النقد من أول شهر التاريخ ولغاية نهاية يوم التقرير (فرق أرصدة القيود). */
  const availableCashMonthScoped = new Decimal(cashBalanceEod).minus(cashBalanceBeforeReportMonth).toNumber();

  const operations = invoiceRows.map((inv) => {
    const alloc = inv.vaultAllocations ?? [];
    let vaultNameAr: string | null = null;
    let vaultNameEn: string | null = null;
    let paymentChannel: string | null = null;
    if (alloc.length > 1) {
      vaultNameAr = alloc.map((a) => `${a.vault?.nameAr ?? '—'}: ${a.amount.toString()}`).join(' · ');
      vaultNameEn = alloc
        .map((a) => `${(a.vault?.nameEn ?? a.vault?.nameAr) ?? '—'}: ${a.amount.toString()}`)
        .join(' · ');
      paymentChannel = vaultNameAr;
    } else if (alloc.length === 1) {
      const v0 = alloc[0].vault;
      vaultNameAr = v0?.nameAr ?? null;
      vaultNameEn = v0?.nameEn ?? null;
      paymentChannel = v0?.paymentMethod?.trim() || v0?.nameAr || null;
    } else {
      vaultNameAr = inv.vault?.nameAr ?? null;
      vaultNameEn = inv.vault?.nameEn ?? null;
      paymentChannel = inv.vault?.paymentMethod?.trim() || inv.vault?.nameAr || null;
    }
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      kind: inv.kind,
      status: inv.status,
      totalAmount: inv.totalAmount.toString(),
      netAmount: inv.netAmount.toString(),
      taxAmount: inv.taxAmount.toString(),
      transactionDate: inv.transactionDate,
      hasInvoiceAttachment: !!(inv.attachmentPath && String(inv.attachmentPath).trim()),
      attachmentOriginalName: inv.attachmentOriginalName ?? null,
      supplierNameAr: inv.supplier?.nameAr ?? null,
      supplierNameEn: inv.supplier?.nameEn ?? null,
      employeeName: inv.employee?.name || null,
      expenseLineNameAr: inv.expenseLine?.nameAr ?? null,
      expenseLineNameEn: inv.expenseLine?.nameEn ?? null,
      vaultNameAr,
      vaultNameEn,
      vaultType: inv.vault?.type || alloc[0]?.vault?.type || null,
      paymentChannel,
    };
  });

  const salesLite = salesSummaries.map((s) => ({
    id: s.id,
    summaryNumber: s.summaryNumber,
    customerCount: s.customerCount,
    cashOnHand: s.cashOnHand.toString(),
    totalAmount: s.totalAmount.toString(),
    channels: s.channels.map((ch) => ({
      vaultNameAr: ch.vault?.nameAr ?? '—',
      vaultNameEn: ch.vault?.nameEn ?? null,
      vaultType: ch.vault?.type ?? null,
      amount: ch.amount.toString(),
    })),
  }));

  return {
    date: d,
    meta: {
      invoiceCountAll,
      operationsReturned: invoiceRows.length,
      invoicesTruncated,
      cashMonthScopeStart: monthStartYmd,
      cashMonthLedgerBaselineDate: dayBeforeReportMonth,
    },
    sums,
    byKind,
    salesSummaries: salesLite,
    outflowByPaymentMethod,
    transfers: {
      count: transferAgg._count._all,
      volume: (transferAgg._sum.amount ?? new Prisma.Decimal(0)).toString(),
    },
    vaults: {
      movementOnDayByVault: vaultsDayLite,
    },
    cash: {
      dayTotalIn: cashDayIn,
      dayTotalOut: cashDayOut,
      netDay: new Decimal(cashDayIn).minus(cashDayOut).toNumber(),
      /** تراكمي لجميع الفترات — للمرجعية؛ لا يُعرض كـ «كاش الشهر». */
      balanceLifetimeCashVaultsEod: cashBalanceEod,
      /** الكاش المتوفر ضمن شهر تقويم التقرير: صافي الحركة من أول الشهر حتى نهاية اليوم. */
      availableCashMonthScoped,
      /** توافق خلفي: الرصيد التراكمي لخزائن النقد حتى نهاية يوم التقرير. */
      balanceEndOfDayCashVaults: cashBalanceEod,
    },
    operations,
  };
}
