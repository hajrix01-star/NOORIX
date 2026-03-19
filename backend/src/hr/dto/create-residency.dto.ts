import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
} from 'class-validator';

const RESIDENCY_STATUSES = ['active', 'expired', 'renewed'] as const;

export class CreateResidencyDto {
  @IsString()
  companyId: string;

  @IsString()
  employeeId: string;

  @IsString()
  iqamaNumber: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsDateString()
  expiryDate: string;

  @IsOptional()
  @IsString()
  @IsIn(RESIDENCY_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
