import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class PurchaseBatchSummariesQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  @Matches(YMD_PATTERN)
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(YMD_PATTERN)
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  lang?: string;
}
