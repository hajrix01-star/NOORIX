import {
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  ValidateIf,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateExpenseLineDto {
  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsIn(['fixed_expense', 'expense'])
  kind?: 'fixed_expense' | 'expense';

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  serviceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  referenceAmount?: number | null;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allowPaymentAmountOverride?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  annualTotalAmount?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsIn([1, 2, 3, 4, 6, 12])
  @Type(() => Number)
  installmentIntervalMonths?: number | null;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
