import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const REPORT_GROUPS = ['sales', 'purchases', 'expenses', 'grossProfit', 'netProfit'] as const;

export class GetGeneralProfitLossQueryDto {
  @IsString()
  companyId: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;
}

export class GetGeneralProfitLossDetailsQueryDto {
  @IsString()
  companyId: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsIn(REPORT_GROUPS)
  groupKey: (typeof REPORT_GROUPS)[number];

  @IsOptional()
  @IsString()
  itemKey?: string;
}

export class GetGeneralProfitLossTrendQueryDto {
  @IsString()
  companyId: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsIn(REPORT_GROUPS)
  groupKey: (typeof REPORT_GROUPS)[number];

  @IsOptional()
  @IsString()
  itemKey?: string;
}
