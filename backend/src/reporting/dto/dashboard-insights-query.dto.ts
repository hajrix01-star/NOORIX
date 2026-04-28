import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/**
 * Query for GET /reporting/insights/dashboard — mirrors {@link ../reporting.facade#DashboardSummaryDateRange}.
 */
export class GetDashboardInsightsQueryDto {
  @IsString()
  companyId: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  yearStart: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  yearEnd: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dailyStart?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dailyEnd?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  monthStart?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  monthEnd?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
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
