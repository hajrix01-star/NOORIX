import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** دفعة راتب لموظف واحد، مرتبطة بشهر المسير ولا تعامل كمصروف عادي. */
export class IssueIndividualSalaryPaymentDto {
  @IsString()
  companyId: string;

  @IsString()
  employeeId: string;

  @IsDateString()
  payrollMonth: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsString()
  vaultId: string;

  @IsDateString()
  transactionDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string;
}
