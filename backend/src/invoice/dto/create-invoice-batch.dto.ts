import {
  IsString,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsBoolean,
  IsIn,
  IsDateString,
  IsArray,
  ValidateNested,
  Allow,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const INVOICE_KINDS = [
  'purchase',
  'expense',
  'hr_expense',
  'fixed_expense',
  'salary',
  'advance',
  'sale',
] as const;

export class BatchInvoiceItemDto {
  /** اختياري للفواتير الحكومية/الخدمية (fixed_expense) — عند عدم وجود مورد تُستخدم notes */
  @IsOptional()
  @IsString()
  supplierId?: string;

  /** بند مصروف — عند التحديد يُستمد منه supplierId و categoryId و kind */
  @IsOptional()
  @IsString()
  expenseLineId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  /** سيريال — يُولَّد تلقائياً. إن أُرسل يُستخدم كـ supplierInvoiceNumber للتوافق */
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  /** رقم فاتورة المورد — مطلوب للمشتريات والمصروفات */
  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @IsIn(INVOICE_KINDS)
  kind: (typeof INVOICE_KINDS)[number];

  @IsNumber()
  @Min(0.01, { message: 'المبلغ يجب أن يكون أكبر من صفر' })
  @Max(10_000_000, { message: 'المبلغ الإجمالي لا يمكن أن يتجاوز 10,000,000' })
  @Type(() => Number)
  totalAmount: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isTaxable?: boolean;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  /** حساب المدين — من الفئة المختارة (للربط بـ P&L) */
  @IsOptional()
  @IsString()
  debitAccountId?: string;

  /** ملاحظة / تفاصيل — مطلوب للفواتير الحكومية/الخدمية بدون مورد */
  @Allow()
  @IsOptional()
  @IsString()
  notes?: string;

  /** متابعة ضمان (مشتريات فقط) — بدون مدة؛ تُكمَّل في قسم الضمان */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  warrantyFollowUp?: boolean;
}

export class CreateInvoiceBatchDto {
  @IsString()
  companyId: string;

  @IsDateString()
  transactionDate: string;

  @IsOptional()
  @IsString()
  vaultId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchInvoiceItemDto)
  items: BatchInvoiceItemDto[];

  /** ملاحظة الدفعة — تُضاف لكل فاتورة بعد ملاحظة السطر (إن وُجدت)، مفصولاً بـ « + » */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  batchNotes?: string;

  /** مفتاح عدم التكرار — يُرسَل من الـ Frontend لمنع الحفظ المزدوج */
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
