import { IsString, IsOptional, IsIn, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseLineDto {
  @IsString()
  companyId: string;

  @IsString()
  nameAr: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsIn(['fixed_expense', 'expense'])
  kind: 'fixed_expense' | 'expense';

  @IsString()
  categoryId: string;

  @IsString()
  supplierId: string;

  @IsOptional()
  @IsString()
  serviceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** مبلغ مرجعي (مثلاً لكل دفعة دورية) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  referenceAmount?: number;

  /** إن false: عند السداد يُثبَّت المبلغ على referenceAmount */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allowPaymentAmountOverride?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
