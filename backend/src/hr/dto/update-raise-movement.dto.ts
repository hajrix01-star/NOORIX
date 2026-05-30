import { IsDateString, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRaiseMovementDto {
  @IsNumber()
  @Type(() => Number)
  increment: number;

  @IsDateString()
  effectiveDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;
}
