import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class IssueResidencyInvoiceDto {
  @IsString()
  companyId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  vaultId: string;

  @IsOptional()
  @IsString()
  transactionDate?: string;
}
