import { BadRequestException } from '@nestjs/common';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import { computeOutflowNetTaxFromTotal } from './invoice-outflow-tax.util';

/**
 * رقم فاتورة المورد مطلوب عند مورد/بند + أنواع معينة + خاضع للضريبة.
 */
export function assertCreateInvoiceSupplierInvoiceNumberIfRequired(dto: CreateInvoiceDto): void {
  const needsSupplierNumber =
    (dto.supplierId || dto.expenseLineId) &&
    ['purchase', 'expense', 'fixed_expense'].includes(dto.kind) &&
    dto.isTaxable !== false;
  if (needsSupplierNumber && !dto.supplierInvoiceNumber?.trim()) {
    throw new BadRequestException('رقم فاتورة المورد مطلوب عند وجود مورد وفاتورة خاضعة للضريبة');
  }
}

/**
 * يُرجع صافي وضريبة كنص (للمحرك المالي) من الإجمالي أو من الحقول الممررة.
 */
export function computeCreateInvoiceOutflowNetAndTax(
  dto: CreateInvoiceDto,
  vatRatePercent?: number | string | null,
): { net: string; tax: string } {
  const taxable = dto.isTaxable !== false;
  return computeOutflowNetTaxFromTotal(dto.totalAmount, taxable, vatRatePercent);
}
