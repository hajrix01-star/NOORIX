import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateInvoiceDto } from './create-invoice.dto';
import { InvoiceVaultSplitDto } from './invoice-vault-split.dto';

const INVOICE_UPDATE_KINDS = [
  'purchase',
  'expense',
  'hr_expense',
  'fixed_expense',
  'salary',
  'advance',
  'sale',
] as const;

class UpdateInvoiceBaseDto extends PartialType(
  OmitType(CreateInvoiceDto, ['companyId', 'kind', 'idempotencyKey', 'batchId'] as const),
) {}

export class UpdateInvoiceDto extends UpdateInvoiceBaseDto {
  @IsOptional()
  @IsIn(INVOICE_UPDATE_KINDS)
  kind?: (typeof INVOICE_UPDATE_KINDS)[number];

  @IsOptional()
  @IsIn(['active', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceVaultSplitDto)
  vaultSplits?: InvoiceVaultSplitDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  installmentCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  installmentAmount?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  warrantyFollowUpDone?: boolean;
}
