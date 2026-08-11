import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class HrCompanyQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;
}

export class HrEmployeeQueryDto extends HrCompanyQueryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class HrYearQueryDto extends HrCompanyQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;
}

export class HrPayrollReconciliationQueryDto extends HrYearQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeRows?: boolean = false;
}

export class HrPayrollRunItemsQueryDto extends HrCompanyQueryDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;
}

export class HrCompensationSnapshotsQueryDto extends HrCompanyQueryDto {
  @IsOptional()
  @IsString()
  employeeIds?: string;
}

export class HrLeavesQueryDto extends HrEmployeeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;
}

export class HrLeaveSalarySettlementsQueryDto extends HrCompanyQueryDto {
  @IsString()
  @IsNotEmpty()
  payrollMonth!: string;
}

export class HrDeleteLeaveQueryDto extends HrCompanyQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  voidSettlement?: boolean = false;
}

export class HrResidenciesQueryDto extends HrEmployeeQueryDto {
  @IsOptional()
  @IsString()
  serviceCategory?: string;
}

export class HrDeleteResidencyQueryDto extends HrCompanyQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  voidInvoice?: boolean = false;
}
