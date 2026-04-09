import { IsString, IsDateString, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class VaultSplitDto {
  @IsString()
  vaultId: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;
}

export class IssuePayrollPaymentDto {
  @IsString()
  payrollRunId: string;

  @IsDateString()
  transactionDate: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VaultSplitDto)
  vaultSplits?: VaultSplitDto[];
}
