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
  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  expenseLineId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

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

  @IsOptional()
  @IsString()
  debitAccountId?: string;

  @Allow()
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  batchNotes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
