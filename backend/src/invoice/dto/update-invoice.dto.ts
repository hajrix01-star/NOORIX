import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsIn,
  IsDateString,
  Allow,
  IsInt,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceVaultSplitDto } from './invoice-vault-split.dto';

export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  /** السيريال الداخلي — غير قابل للتعديل */
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @IsOptional()
  @IsIn(['purchase', 'expense', 'sale'])
  kind?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  totalAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  netAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxAmount?: number;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @IsOptional()
  @IsDateString()
  settledAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  settledAmount?: number;

  @IsOptional()
  @IsString()
  vaultId?: string;

  /** توزيع السداد على أكثر من خزنة — يتجاوز vaultId عند الإرسال */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceVaultSplitDto)
  vaultSplits?: InvoiceVaultSplitDto[];

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsIn(['active', 'cancelled'])
  status?: string;

  @Allow()
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  installmentCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  installmentAmount?: number;

  /** إكمال متابعة الضمان من قسم الضمان — تُخرج الفاتورة من قائمة الانتظار */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  warrantyFollowUpDone?: boolean;
}
