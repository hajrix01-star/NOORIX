import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { buildInvoiceTransactionDateFilter } from './invoice-transaction-date-filter.util';
import type { PurchaseBatchSummariesQueryContract } from './purchase-batch-summaries-query-contract.util';

const MAX_ROWS = 60_000;

/**
 * ملخص دفعات المشتريات/المصروفات في الفترة — استعلام واحد ثم تجميع في الذاكرة.
 */
export async function loadPurchaseBatchSummaries(
  prisma: TenantPrismaService,
  query: PurchaseBatchSummariesQueryContract,
) {
  const { companyId, startDate, endDate, q, lang } = query;
  const dateFilter = buildInvoiceTransactionDateFilter(startDate, endDate);
  const where: Prisma.InvoiceWhereInput = {
    companyId,
    batchId: { not: null },
    kind: { in: ['purchase', 'expense', 'fixed_expense'] },
    ...dateFilter,
  };

  const rowCount = await prisma.invoice.count({ where });
  if (rowCount > MAX_ROWS) {
    throw new BadRequestException(
      `عدد فواتير الدفعات في الفترة (${rowCount}) يتجاوز الحد المسموح (${MAX_ROWS}). اضيّق نطاق التاريخ.`,
    );
  }

  const rows = await prisma.invoice.findMany({
    where,
    select: {
      id: true,
      batchId: true,
      status: true,
      transactionDate: true,
      netAmount: true,
      taxAmount: true,
      totalAmount: true,
      notes: true,
      supplier: { select: { nameAr: true, nameEn: true } },
      vault: { select: { nameAr: true, nameEn: true } },
    },
    orderBy: { transactionDate: 'desc' },
  });

  const byBatch = new Map<string, typeof rows>();
  for (const r of rows) {
    const bid = r.batchId as string;
    if (!byBatch.has(bid)) byBatch.set(bid, []);
    byBatch.get(bid)!.push(r);
  }

  const batches = [];
  for (const [batchId, invs] of byBatch) {
    const activeCount = invs.filter((i) => i.status === 'active').length;
    const cancelledCount = invs.filter((i) => i.status === 'cancelled').length;
    const status = cancelledCount === 0 ? 'active' : activeCount === 0 ? 'cancelled' : 'partial';
    const pickName = (ar?: string | null, en?: string | null) => (lang === 'en' ? (en || ar || '') : (ar || en || ''));

    const supplierNames = [
      ...new Set(
        invs
          .map((i) => pickName(i.supplier?.nameAr, i.supplier?.nameEn) || i.notes || '')
          .filter(Boolean),
      ),
    ].join(' | ');
    const netAmount = invs.reduce((s, i) => s.plus(new Decimal(i.netAmount.toString())), new Decimal(0));
    const taxAmount = invs.reduce((s, i) => s.plus(new Decimal(i.taxAmount.toString())), new Decimal(0));
    const totalAmount = invs.reduce((s, i) => s.plus(new Decimal(i.totalAmount.toString())), new Decimal(0));
    const transactionDate = invs[0]?.transactionDate;
    const vaultLabels = [
      ...new Set(
        invs
          .map((i) => pickName(i.vault?.nameAr, i.vault?.nameEn))
          .filter(Boolean),
      ),
    ];
    const vaultName = vaultLabels.length ? vaultLabels.join(' | ') : '—';
    batches.push({
      batchId,
      transactionDate,
      invoiceCount: invs.length,
      supplierNames: supplierNames || '—',
      vaultName,
      netAmount: netAmount.toFixed(4),
      taxAmount: taxAmount.toFixed(4),
      totalAmount: totalAmount.toFixed(4),
      status,
    });
  }

  const needle = (q || '').trim().toLowerCase();
  const filteredBatches =
    needle.length > 0
      ? batches.filter(
          (b) =>
            String(b.batchId || '')
              .toLowerCase()
              .includes(needle) ||
            String(b.supplierNames || '')
              .toLowerCase()
              .includes(needle) ||
            String(b.vaultName || '')
              .toLowerCase()
              .includes(needle),
        )
      : batches;

  filteredBatches.sort((a, b) => {
    const ta = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
    const tb = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
    return tb - ta;
  });

  return { batches: filteredBatches, rowCount: filteredBatches.length };
}
