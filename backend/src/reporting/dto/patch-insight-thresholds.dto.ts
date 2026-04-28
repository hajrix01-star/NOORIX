import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class PurchaseExpenseThresholdBandPatchDto {
  @IsOptional()
  @IsNumber()
  warning?: number;

  @IsOptional()
  @IsNumber()
  critical?: number;
}

export class NetProfitMarginBandPatchDto {
  @IsOptional()
  @IsNumber()
  warningBelow?: number;

  @IsOptional()
  @IsNumber()
  criticalBelow?: number;
}

export class PatchInsightThresholdsDto {
  @IsString()
  companyId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PurchaseExpenseThresholdBandPatchDto)
  purchaseToSales?: PurchaseExpenseThresholdBandPatchDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PurchaseExpenseThresholdBandPatchDto)
  expenseToSales?: PurchaseExpenseThresholdBandPatchDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NetProfitMarginBandPatchDto)
  netProfitMargin?: NetProfitMarginBandPatchDto;
}
