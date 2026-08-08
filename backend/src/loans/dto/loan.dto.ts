import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateLoanDto {
  @IsString() @IsNotEmpty() @MaxLength(160) nameAr!: string;
  @IsOptional() @IsString() @MaxLength(160) creditorName?: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) @Max(999_999_999.9999) amount!: number;
  @IsDateString() openingDate!: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10_000) historicalPaymentsCount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(999_999_999.9999) historicalPaidAmount?: number;
  @IsOptional() @IsDateString() historicalPaidThroughDate?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) idempotencyKey!: string;
}

export class CreateLoanPaymentDto {
  @IsString() @IsNotEmpty() vaultId!: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) @Max(999_999_999.9999) amount!: number;
  @IsDateString() transactionDate!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) idempotencyKey!: string;
}

export class ReverseLoanPaymentDto {
  @IsDateString() transactionDate!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) idempotencyKey!: string;
}

export class MigrateLoanLegacyInvoicesDto {
  @IsString() @IsNotEmpty() expenseLineId!: string;
  @IsOptional() archiveExpenseLine?: boolean;
}
