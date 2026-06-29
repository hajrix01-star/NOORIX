import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class IssueLeaveSalarySettlementDto {
  /** إن وُجد يُستخدم بدل المبلغ المقترح (تقويمي). */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  grossAmount?: number;

  @IsOptional()
  @IsString()
  @MinLength(5)
  manualOverrideReason?: string;

  @IsOptional()
  @IsString()
  vaultId?: string;
}
