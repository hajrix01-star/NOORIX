import { IsString, IsOptional, IsIn, IsBoolean, IsNumber, Min, Max, MaxLength } from 'class-validator';
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
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
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

  /** إجمالي سنوي متوقع — لاقتراح مبلغ كل دفعة مع installmentIntervalMonths */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  annualTotalAmount?: number;

  /** فترة الدفع بالأشهر (يجب أن يقسم 12): 1،2،3،4،6،12 */
  @IsOptional()
  @IsIn([1, 2, 3, 4, 6, 12])
  @Type(() => Number)
  installmentIntervalMonths?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
