import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePurchaseDebtDto {
  @IsString()
  supplierId: string;

  @IsString()
  @MaxLength(120)
  supplierInvoiceNumber: string;

  @IsDateString()
  invoiceDate: string;

  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  @Type(() => Number)
  totalAmount: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isTaxable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
