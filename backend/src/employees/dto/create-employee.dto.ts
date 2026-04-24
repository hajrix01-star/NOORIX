import {
  IsString, IsOptional, IsNumber, IsDateString,
  IsIn, Min, Max, MaxLength, Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateEmployeeDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'رقم الهوية/الإقامة يجب أن يكون 10 أرقام بالضبط' })
  iqamaNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobTitle?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500_000, { message: 'الراتب الأساسي لا يمكن أن يتجاوز 500,000' })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  })
  basicSalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300_000, { message: 'بدل السكن لا يمكن أن يتجاوز 300,000' })
  @Transform(({ value }) => Number(value ?? 0))
  housingAllowance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50_000, { message: 'بدل المواصلات لا يمكن أن يتجاوز 50,000' })
  @Transform(({ value }) => Number(value ?? 0))
  transportAllowance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200_000, { message: 'البدلات الأخرى لا يمكن أن تتجاوز 200,000' })
  @Transform(({ value }) => Number(value ?? 0))
  otherAllowance?: number;

  @IsOptional()
  @IsDateString()
  joinDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  workHours?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workSchedule?: string;

  @IsOptional()
  @IsIn(['active', 'terminated', 'on_leave', 'archived'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;

  @IsString()
  companyId: string;
}
