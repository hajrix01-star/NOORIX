import { IsOptional, IsString, IsNumber, Min, IsIn, IsDateString, Allow } from 'class-validator';
import { Type } from 'class-transformer';

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
}
