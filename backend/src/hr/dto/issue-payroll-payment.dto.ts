import { IsString, IsDateString } from 'class-validator';

export class IssuePayrollPaymentDto {
  @IsString()
  payrollRunId: string;

  @IsDateString()
  transactionDate: string;
}
