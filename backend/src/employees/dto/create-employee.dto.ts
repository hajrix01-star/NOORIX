import {
  IsString, IsOptional, IsNumber, IsDateString,
  IsIn, Min, MaxLength,
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
  @MaxLength(20)
  iqamaNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobTitle?: string;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  basicSalary: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value ?? 0))
  housingAllowance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value ?? 0))
  transportAllowance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value ?? 0))
  otherAllowance?: number;

  @IsDateString()
  joinDate: string;

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
  notes?: string;

  @IsString()
  companyId: string;
}
