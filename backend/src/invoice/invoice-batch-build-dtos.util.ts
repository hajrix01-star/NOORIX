import Decimal from 'decimal.js';
import { splitTax } from '../common/utils/math-engine';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { OutflowDto } from '../financial-core/dto/financial-operation.dto';
import type { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';

function combineLineAndBatchNotes(lineNotes: string | undefined, batchNotesPart: string): string | undefined {
  const line = lineNotes?.trim() ?? '';
  if (!batchNotesPart) return line || undefined;
  if (!line) return batchNotesPart;
  return `${line} + ${batchNotesPart}`;
}

/** يبني مصفوفة `OutflowDto` لدفعة فواتير (استعلام expense line لكل بند عند الحاجة). */
export async function buildOutflowDtosForInvoiceBatch(
  prisma: TenantPrismaService,
  companyId: string,
  validItems: CreateInvoiceBatchDto['items'],
  txDate: string,
  batchId: string,
  vaultId: string | undefined,
  batchNotesPart: string,
): Promise<OutflowDto[]> {
  const dtos: OutflowDto[] = [];
  for (const item of validItems) {
    let supplierId = item.supplierId || undefined;
    let categoryId = item.categoryId || undefined;
    let kind = item.kind as 'purchase' | 'expense' | 'hr_expense' | 'fixed_expense';
    let debitAccountId = (item.debitAccountId && item.debitAccountId.trim()) ? item.debitAccountId : undefined;

    if (item.expenseLineId) {
      const line = await prisma.expenseLine.findFirst({
        where: { id: item.expenseLineId, companyId },
        include: { category: { select: { accountId: true } } },
      });
      if (line) {
        supplierId = line.supplierId;
        categoryId = line.categoryId;
        kind = line.kind as 'fixed_expense' | 'expense';
        debitAccountId = debitAccountId || line.category?.accountId || undefined;
      }
    }

    const total = new Decimal(String(item.totalAmount));
    const taxable = item.isTaxable !== false;
    const rate = taxable ? 0.15 : 0;
    const { net, tax } = splitTax(total, rate);
    dtos.push({
      companyId,
      supplierId,
      expenseLineId: item.expenseLineId || undefined,
      categoryId,
      supplierInvoiceNumber: item.supplierInvoiceNumber ?? item.invoiceNumber ?? undefined,
      kind,
      totalAmount: total.toFixed(4),
      netAmount: net.toFixed(4),
      taxAmount: tax.toFixed(4),
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
