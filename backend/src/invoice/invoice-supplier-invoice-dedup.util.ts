import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { OutflowDto } from '../financial-core/dto/financial-operation.dto';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';

/** أنواع الصرف التي تُطبَّق عليها سياسة عدم تكرار رقم فاتورة المورد لكل مورد. */
export const INVOICE_KINDS_SUPPLIER_INVOICE_DEDUP = [
  'purchase',
  'expense',
  'fixed_expense',
  'hr_expense',
] as const;

export type InvoiceKindWithSupplierInvoiceDedup = (typeof INVOICE_KINDS_SUPPLIER_INVOICE_DEDUP)[number];

const EASTERN_ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/**
 * مفتاح تطبيع موحّد لمنع التكرار: إزالة المسافات، NFKC، تحويل الأرقام العربية/الفارسية إلى لاتينية، حروف صغيرة.
 */
export function normalizeSupplierInvoiceDedupKey(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw).normalize('NFKC').trim().replace(/\s+/g, '');
  if (!s) return null;
  s = s.replace(/[٠-٩]/g, (c) => String(EASTERN_ARABIC_DIGITS.indexOf(c)));
  s = s.replace(/[۰-۹]/g, (c) => String(PERSIAN_DIGITS.indexOf(c)));
  return s.toLowerCase();
}

export function computeSupplierInvoiceDedupKeyForInvoiceRow(p: {
  supplierId: string | null | undefined;
  kind: string;
  supplierInvoiceNumber: string | null | undefined;
  status: string;
}): string | null {
  if (p.status !== 'active') return null;
  if (!p.supplierId) return null;
  if (!INVOICE_KINDS_SUPPLIER_INVOICE_DEDUP.includes(p.kind as InvoiceKindWithSupplierInvoiceDedup)) {
    return null;
  }
  return normalizeSupplierInvoiceDedupKey(p.supplierInvoiceNumber);
}

export function computeSupplierInvoiceDedupKeyForOutflowDto(dto: OutflowDto): string | null {
  return computeSupplierInvoiceDedupKeyForInvoiceRow({
    supplierId: dto.supplierId ?? null,
    kind: dto.kind,
    supplierInvoiceNumber: dto.supplierInvoiceNumber,
    status: 'active',
  });
}

/** رفض تكرار (مورد + رقم فاتورة مورد مُطبَّع) داخل نفس الدفعة قبل الحفظ. */
export function assertOutflowBatchNoDuplicateSupplierInvoiceKeys(dtos: OutflowDto[]): void {
  const seen = new Map<string, number>();
  for (let i = 0; i < dtos.length; i++) {
    const dto = dtos[i]!;
    const key = computeSupplierInvoiceDedupKeyForOutflowDto(dto);
    if (!key || !dto.supplierId) continue;
    const compound = `${dto.companyId}\u0001${dto.supplierId}\u0001${key}`;
    if (seen.has(compound)) {
      const firstIdx = seen.get(compound)! + 1;
      throw new BadRequestException(
        `تكرار داخل الدفعة: نفس المورد ورقم فاتورة المورد في السطر ${firstIdx} والسطر ${i + 1}. عدّل أحد الرقمين أو ادمج البندين.`,
      );
    }
    seen.set(compound, i);
  }
}

type InvoiceTx = Pick<Prisma.TransactionClient, 'invoice'>;

export async function assertNoActiveDuplicateSupplierInvoiceDedupKey(
  tx: InvoiceTx,
  p: {
    companyId: string;
    supplierId: string | null | undefined;
    dedupKey: string | null;
    excludeInvoiceId?: string;
  },
): Promise<void> {
  const { companyId, supplierId, dedupKey, excludeInvoiceId } = p;
  if (!dedupKey || !supplierId) return;

  const other = await tx.invoice.findFirst({
    where: {
      companyId,
      supplierId,
      supplierInvoiceDedupKey: dedupKey,
      status: 'active',
      ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
    },
    select: { invoiceNumber: true },
  });
  if (other) {
    throw new BadRequestException(
      `يوجد بالفعل فاتورة نشطة لنفس المورد بنفس رقم فاتورة المورد (السيريال الداخلي: ${other.invoiceNumber}).`,
    );
  }
}

/**
 * يُحدّث حقل المفتاح المُطبَّع عند التعديل — يُستدعى قبل `invoice.update`.
 */
export function patchSupplierInvoiceDedupKeyOnUpdateInput(
  updateData: Prisma.InvoiceUncheckedUpdateInput,
  oldInvoice: {
    supplierId: string | null;
    supplierInvoiceNumber: string | null;
    kind: string;
    status: string;
  },
  dto: UpdateInvoiceDto,
): void {
  const merged = {
    supplierId: dto.supplierId !== undefined ? (dto.supplierId as string | null) : oldInvoice.supplierId,
    supplierInvoiceNumber:
      dto.supplierInvoiceNumber !== undefined ?
        (dto.supplierInvoiceNumber as string | null)
      : oldInvoice.supplierInvoiceNumber,
    kind: dto.kind !== undefined ? (dto.kind as string) : oldInvoice.kind,
    status: dto.status !== undefined ? (dto.status as string) : oldInvoice.status,
  };
  updateData.supplierInvoiceDedupKey = computeSupplierInvoiceDedupKeyForInvoiceRow({
    supplierId: merged.supplierId,
    kind: merged.kind,
    supplierInvoiceNumber: merged.supplierInvoiceNumber,
    status: merged.status,
  });
}
