import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { splitTax } from '../common/utils/math-engine';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';

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
export function computeCreateInvoiceOutflowNetAndTax(dto: CreateInvoiceDto): { net: string; tax: string } {
  const total = new Decimal(String(dto.totalAmount));
  const taxable = dto.isTaxable !== false;
  if (dto.netAmount != null && dto.taxAmount != null) {
    return { net: String(dto.netAmount), tax: String(dto.taxAmount) };
  }
  const rate = taxable ? 0.15 : 0;
  const { net: netDec, tax: taxDec } = splitTax(total, rate);
  return { net: netDec.toFixed(4), tax: taxDec.toFixed(4) };
}
