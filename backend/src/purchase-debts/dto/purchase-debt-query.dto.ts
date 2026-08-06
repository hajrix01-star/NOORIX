import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class PurchaseDebtQueryDto {
  @IsOptional() @IsIn(['pending', 'promoted', 'cancelled']) status?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsDateString() invoiceFrom?: string;
  @IsOptional() @IsDateString() invoiceTo?: string;
  @IsOptional() @IsDateString() promotedFrom?: string;
  @IsOptional() @IsDateString() promotedTo?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) amountMin?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) amountMax?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page = 1;
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) pageSize = 25;
}
