import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const MOVEMENT_TYPES = ['promotion', 'raise', 'other'] as const;

export class CreateMovementDto {
  @IsString()
  companyId: string;

  @IsString()
  employeeId: string;

  @IsString()
  @IsIn(MOVEMENT_TYPES)
  movementType: (typeof MOVEMENT_TYPES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  previousValue?: string;

  @IsOptional()
  @IsString()
  newValue?: string;

  @IsDateString()
  effectiveDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
