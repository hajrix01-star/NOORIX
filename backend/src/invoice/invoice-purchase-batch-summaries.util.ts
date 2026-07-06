import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { buildInvoiceTransactionDateFilter } from './invoice-transaction-date-filter.util';
import type { PurchaseBatchSummariesQueryContract } from './purchase-batch-summaries-query-contract.util';

const MAX_ROWS = 60_000;
const EMPTY_LABEL = '—';

type PurchaseBatchSummaryRow = Awaited<ReturnType<typeof loadPurchaseBatchRows>>[number];

function localizedInvoiceSummaryName(
  source: { nameAr?: string | null; nameEn?: string | null } | null | undefined,
  lang: string,
) {
  const ar = source?.nameAr?.trim();
  const en = source?.nameEn?.trim();
  return lang === 'en' ? en || ar || '' : ar || en || '';
}

function addUniqueLabel(labels: Set<string>, label: string | null | undefined) {
  const trimmed = label?.trim();
  if (trimmed) labels.add(trimmed);
}

function moneyTotal(rows: PurchaseBatchSummaryRow[], field: 'netAmount' | 'taxAmount' | 'totalAmount') {
  return rows.reduce((sum, row) => sum.plus(new Decimal(row[field].toString())), new Decimal(0));
}

async function loadPurchaseBatchRows(prisma: TenantPrismaService, where: Prisma.InvoiceWhereInput) {
  const rows = await prisma.invoice.findMany({
    where,
    take: MAX_ROWS + 1,
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

  if (rows.length > MAX_ROWS) {
    throw new BadRequestException(
      `عدد فواتير الدفعات في الفترة يتجاوز الحد المسموح (${MAX_ROWS}). ضيّق نطاق التاريخ.`,
    );
  }

  return rows;
}

function groupPurchaseBatchRows(rows: PurchaseBatchSummaryRow[]) {
  const byBatch = new Map<string, PurchaseBatchSummaryRow[]>();
  for (const row of rows) {
    if (!row.batchId) continue;
    const batchRows = byBatch.get(row.batchId) ?? [];
    batchRows.push(row);
    byBatch.set(row.batchId, batchRows);
  }
  return byBatch;
}

function summarizePurchaseBatch(batchId: string, rows: PurchaseBatchSummaryRow[], lang: string) {
  let activeCount = 0;
  let cancelledCount = 0;
  const supplierLabels = new Set<string>();
  const vaultLabels = new Set<string>();

  for (const row of rows) {
    if (row.status === 'active') activeCount += 1;
    if (row.status === 'cancelled') cancelledCount += 1;
    addUniqueLabel(supplierLabels, localizedInvoiceSummaryName(row.supplier, lang) || row.notes);
    addUniqueLabel(vaultLabels, localizedInvoiceSummaryName(row.vault, lang));
  }

  return {
    batchId,
    transactionDate: rows[0]?.transactionDate,
    invoiceCount: rows.length,
    supplierNames: [...supplierLabels].join(' | ') || EMPTY_LABEL,
    vaultName: vaultLabels.size ? [...vaultLabels].join(' | ') : EMPTY_LABEL,
    netAmount: moneyTotal(rows, 'netAmount').toFixed(4),
    taxAmount: moneyTotal(rows, 'taxAmount').toFixed(4),
    totalAmount: moneyTotal(rows, 'totalAmount').toFixed(4),
    status: cancelledCount === 0 ? 'active' : activeCount === 0 ? 'cancelled' : 'partial',
  };
}

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

  const rows = await loadPurchaseBatchRows(prisma, where);
  const batches = [...groupPurchaseBatchRows(rows)].map(([batchId, batchRows]) =>
    summarizePurchaseBatch(batchId, batchRows, lang),
  );

  const needle = (q || '').trim().toLowerCase();
  const filteredBatches =
    needle.length > 0
      ? batches.filter(
          (batch) =>
            String(batch.batchId || '').toLowerCase().includes(needle) ||
            String(batch.supplierNames || '').toLowerCase().includes(needle) ||
            String(batch.vaultName || '').toLowerCase().includes(needle),
        )
      : batches;

  filteredBatches.sort((left, right) => {
    const leftTime = left.transactionDate ? left.transactionDate.getTime() : 0;
    const rightTime = right.transactionDate ? right.transactionDate.getTime() : 0;
    return rightTime - leftTime;
  });

  return { batches: filteredBatches, rowCount: filteredBatches.length };
}
