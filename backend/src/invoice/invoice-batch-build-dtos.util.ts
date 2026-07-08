import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { OutflowDto } from '../financial-core/dto/financial-operation.dto';
import type { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';
import { computeOutflowNetTaxFromTotal } from './invoice-outflow-tax.util';

const OUTFLOW_KINDS = ['expense', 'salary', 'purchase', 'sale', 'fixed_expense', 'hr_expense', 'advance'] as const;
type OutflowKind = (typeof OUTFLOW_KINDS)[number];

function resolveOutflowKind(value: string): OutflowKind {
  return OUTFLOW_KINDS.includes(value as OutflowKind) ? (value as OutflowKind) : 'expense';
}

function combineLineAndBatchNotes(lineNotes: string | undefined, batchNotesPart: string): string | undefined {
  const line = lineNotes?.trim() ?? '';
  if (!batchNotesPart) return line || undefined;
  if (!line) return batchNotesPart;
  return `${line} + ${batchNotesPart}`;
}

export async function buildOutflowDtosForInvoiceBatch(
  prisma: TenantPrismaService,
  companyId: string,
  validItems: CreateInvoiceBatchDto['items'],
  txDate: string,
  batchId: string,
  vaultId: string | undefined,
  batchNotesPart: string,
  vatRatePercent?: number | string | null,
): Promise<OutflowDto[]> {
  const dtos: OutflowDto[] = [];
  for (const item of validItems) {
    let supplierId = item.supplierId || undefined;
    let categoryId = item.categoryId || undefined;
    let kind = resolveOutflowKind(item.kind);
    let debitAccountId = item.debitAccountId?.trim() || undefined;

    if (item.expenseLineId) {
      const line = await prisma.expenseLine.findFirst({
        where: { id: item.expenseLineId, companyId },
        include: { category: { select: { accountId: true } } },
      });
      if (line) {
        supplierId = line.supplierId;
        categoryId = line.categoryId;
        kind = resolveOutflowKind(line.kind);
        debitAccountId = debitAccountId || line.category?.accountId || undefined;
      }
    }

    const total = new Decimal(String(item.totalAmount));
    const taxable = item.isTaxable !== false;
    const { net, tax } = computeOutflowNetTaxFromTotal(total, taxable, vatRatePercent);
    dtos.push({
      companyId,
      supplierId,
      expenseLineId: item.expenseLineId || undefined,
      categoryId,
      supplierInvoiceNumber: item.supplierInvoiceNumber ?? item.invoiceNumber ?? undefined,
      kind,
      totalAmount: total.toFixed(4),
      netAmount: net,
      taxAmount: tax,
      transactionDate: txDate,
      invoiceDate: item.invoiceDate,
      batchId,
      vaultId,
      debitAccountId,
      notes: combineLineAndBatchNotes(item.notes, batchNotesPart),
      warrantyFollowUp: ['purchase', 'expense', 'fixed_expense'].includes(kind) && item.warrantyFollowUp === true,
    });
  }
  return dtos;
}
