import {
  IsString, IsNumber, IsArray, IsOptional,
  ValidateNested, Min, IsDateString, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SalesChannelDto {
  @IsString()
  vaultId: string;

  @IsString()
  amount: string;
}

export class CreateSalesSummaryDto {
  @IsString()
  companyId: string;

  @IsDateString()
  transactionDate: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  customerCount: number;

  @IsOptional()
  @IsString()
  cashOnHand?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'يجب إدخال قناة بيع واحدة على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => SalesChannelDto)
  channels: SalesChannelDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  /** مفتاح عدم التكرار — يمنع تنفيذ نفس العملية مرتين (مثلاً عند النقر المزدوج) */
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
