import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/** توزيع خزائن على مستوى مسيرة الرواتب (فاتورة صرف واحدة) */
export class PayrollRunVaultSplitDto {
  @IsString()
  vaultId: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;
}

export class PayrollRunItemDto {
  @IsString()
  employeeId: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  grossSalary: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  allowancesAdd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  deductions?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  advancesDeduct?: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  netSalary: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;
}

export class CreatePayrollRunDto {
  @IsString()
  companyId: string;

  @IsDateString()
  payrollMonth: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollRunItemDto)
  items: PayrollRunItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;

  /** يجب أن يعادل مجموعها صافي المسيرة (مجموع صافي الموظفين) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollRunVaultSplitDto)
  vaultSplits?: PayrollRunVaultSplitDto[];
}
