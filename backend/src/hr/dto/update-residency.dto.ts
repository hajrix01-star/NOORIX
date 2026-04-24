import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  MaxLength,
} from 'class-validator';

const RESIDENCY_STATUSES = ['active', 'expired', 'renewed'] as const;

export class UpdateResidencyDto {
  @IsOptional()
  @IsString()
  iqamaNumber?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(RESIDENCY_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;
}
