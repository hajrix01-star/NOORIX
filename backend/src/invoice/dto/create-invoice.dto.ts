import {
  IsString,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsBoolean,
  IsIn,
  IsDateString,
  ValidateIf,
  Allow,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsAmountConsistent } from '../../common/validators/amount-consistency.validator';
import { InvoiceVaultSplitDto } from './invoice-vault-split.dto';

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
  @Max(10_000_000, { message: 'المبلغ الإجمالي لا يمكن أن يتجاوز 10,000,000' })
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
  @Max(10_000_000, { message: 'الصافي لا يمكن أن يتجاوز 10,000,000' })
  @Type(() => Number)
  netAmount?: number;

  /** اختياري — يُحسب من totalAmount و isTaxable إن لم يُمرَّر */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_500_000, { message: 'مبلغ الضريبة لا يمكن أن يتجاوز 1,500,000' })
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

  /**
   * سداد من عدة خزائن — مجموع amount يجب أن يساوي totalAmount.
   * عند الإرسال يُتجاهل vaultId.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2, { message: 'توزيع الخزائن يتطلب خزنتين على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceVaultSplitDto)
  vaultSplits?: InvoiceVaultSplitDto[];

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

  /** للسلف بالأقساط: عدد الدفعات (1 = دفعة واحدة، سلوك افتراضي) */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  @Type(() => Number)
  installmentCount?: number;

  /** للسلف بالأقساط: مبلغ القسط الواحد (يُحسب تلقائياً = totalAmount / installmentCount) */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  installmentAmount?: number;
}
