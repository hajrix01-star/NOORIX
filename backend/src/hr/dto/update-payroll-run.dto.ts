import { Type } from 'class-transformer';
import { IsOptional, IsString, IsIn, IsArray, IsDateString, ValidateNested } from 'class-validator';
import { PayrollRunItemDto } from './create-payroll-run.dto';

export class UpdatePayrollRunDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  payrollMonth?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollRunItemDto)
  items?: PayrollRunItemDto[];
}

export class UpdatePayrollRunStatusDto {
  @IsString()
  @IsIn(['draft', 'completed'])
  status: string;
}
