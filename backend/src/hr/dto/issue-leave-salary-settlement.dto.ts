import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
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
  vaultId?: string;
}
