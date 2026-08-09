import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// Advance deductions are generated atomically by payroll issuance, together
// with the advance balance and its ledger settlement.  They are deliberately
// absent from the manual HR endpoint.
const DEDUCTION_TYPES = ['penalty', 'other'] as const;

export class CreateDeductionDto {
  @IsString()
  companyId: string;

  @IsString()
  employeeId: string;

  @IsString()
  @IsIn(DEDUCTION_TYPES)
  deductionType: (typeof DEDUCTION_TYPES)[number];

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsDateString()
  transactionDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}
