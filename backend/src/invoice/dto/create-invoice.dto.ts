import {
  IsString,
  IsNumber,
  Min,
  IsOptional,
  IsBoolean,
  IsIn,
  IsDateString,
  ValidateIf,
  Allow,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsAmountConsistent } from '../../common/validators/amount-consistency.validator';

const INVOICE_KINDS = [
  'purchase',
  'expense',
  'hr_expense',
  'fixed_expense',
  'salary',
  'advance',
  'sale',
] as const;

export class CreateInvoiceDto {
  @IsString()
  companyId: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  expenseLineId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  /** سيريال داخلي — يُولَّد تلقائياً، لا يُمرَّر من العميل */
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  /** رقم فاتورة المورد — مطلوب عند وجود مورد (مشتريات، مصروفات) */
  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @IsIn(INVOICE_KINDS)
  kind: (typeof INVOICE_KINDS)[number];

  @IsNumber()
  @Min(0.01, { message: 'المبلغ يجب أن يكون أكبر من صفر' })
  @Type(() => Number)
  @ValidateIf((o) => o.netAmount != null && o.taxAmount != null)
  @IsAmountConsistent({ message: 'الصافي + الضريبة يجب أن يساويا الإجمالي بهامش 0.01' })
  totalAmount: number;

  /** عند true: يُحسب الصافي والضريبة من الإجمالي (15%). عند false: الصافي = الإجمالي، الضريبة = 0 */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isTaxable?: boolean;

  /** اختياري — يُحسب من totalAmount و isTaxable إن لم يُمرَّر */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  netAmount?: number;

  /** اختياري — يُحسب من totalAmount و isTaxable إن لم يُمرَّر */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxAmount?: number;

  @IsDateString()
  transactionDate: string;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  vaultId?: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  /** حساب المدين — اختياري، يُستمد من KIND_TO_ACCOUNT إن لم يُمرَّر */
  @IsOptional()
  @IsString()
  debitAccountId?: string;

  /** ملاحظة / تفاصيل — اسم الموظف، الشهر، تفاصيل فواتير حكومية */
  @Allow()
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  creditAccountId?: string;

  /** مفتاح عدم التكرار — يُرسَل من الـ Frontend لمنع الحفظ المزدوج */
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
