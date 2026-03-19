import {
  IsString, IsNumber, IsArray, IsOptional,
  ValidateNested, Min, IsDateString, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSalesChannelDto {
  @IsString()
  vaultId: string;

  @IsString()
  amount: string;
}

export class UpdateSalesSummaryDto {
  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  customerCount?: number;

  @IsOptional()
  @IsString()
  cashOnHand?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'يجب إدخال قناة بيع واحدة على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => UpdateSalesChannelDto)
  channels?: UpdateSalesChannelDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
