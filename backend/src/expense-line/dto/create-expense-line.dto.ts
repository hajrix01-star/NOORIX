import { IsString, IsOptional, IsIn, IsBoolean } from 'class-validator';
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

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
