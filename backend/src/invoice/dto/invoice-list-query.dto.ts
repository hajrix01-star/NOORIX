import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const INVOICE_YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class InvoiceListQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 50;

  @IsOptional()
  @IsString()
  @Matches(INVOICE_YMD_PATTERN)
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(INVOICE_YMD_PATTERN)
  endDate?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  supplierCategoryId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  expenseLineId?: string;

  @IsOptional()
  @IsString()
  vaultId?: string;

  @IsOptional()
  @IsString()
  createdByUserId?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'transactionDate';

  @IsOptional()
  @IsString()
  sortDir?: string = 'desc';

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeCancelled?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  hasNotes?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  requireExpenseLine?: boolean;
}
