import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import {
  EMPLOYEE_HR_SERVICE_CATEGORIES,
  RESIDENCY_STATUSES,
  requiresIqamaNumber,
} from '../constants/employee-hr-service-categories';

export class CreateResidencyDto {
  @IsString()
  companyId: string;

  @IsString()
  employeeId: string;

  @IsOptional()
  @IsString()
  @IsIn(EMPLOYEE_HR_SERVICE_CATEGORIES)
  serviceCategory?: string;

  @ValidateIf((o) => requiresIqamaNumber(o.serviceCategory ?? 'iqama_renewal'))
  @IsString()
  @Matches(/^\d{10}$/, { message: 'رقم الإقامة يجب أن يكون 10 أرقام' })
  iqamaNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referenceLabel?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(RESIDENCY_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;
}
