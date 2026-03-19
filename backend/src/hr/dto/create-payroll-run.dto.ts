import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PayrollItemVaultSplitDto {
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
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollItemVaultSplitDto)
  vaultSplits?: PayrollItemVaultSplitDto[];
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
  notes?: string;
}
