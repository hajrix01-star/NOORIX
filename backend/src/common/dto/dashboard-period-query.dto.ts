import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const DASHBOARD_YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export abstract class DashboardPeriodQueryDto {
  @IsString()
  companyId: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsString()
  @Matches(DASHBOARD_YMD_PATTERN)
  yearStart: string;

  @IsString()
  @Matches(DASHBOARD_YMD_PATTERN)
  yearEnd: string;

  @IsOptional()
  @IsString()
  @Matches(DASHBOARD_YMD_PATTERN)
  dailyStart?: string;

  @IsOptional()
  @IsString()
  @Matches(DASHBOARD_YMD_PATTERN)
  dailyEnd?: string;

  @IsOptional()
  @IsString()
  @Matches(DASHBOARD_YMD_PATTERN)
  monthStart?: string;

  @IsOptional()
  @IsString()
  @Matches(DASHBOARD_YMD_PATTERN)
  monthEnd?: string;

  @IsString()
  @Matches(DASHBOARD_YMD_PATTERN)
  periodStart: string;

  @IsString()
  @Matches(DASHBOARD_YMD_PATTERN)
  periodEnd: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  selectedMonth?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeCancelledSales?: boolean;
}
