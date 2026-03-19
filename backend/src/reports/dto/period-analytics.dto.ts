import { IsString, Matches } from 'class-validator';

export class GetPeriodAnalyticsQueryDto {
  @IsString()
  companyId: string;

  /** YYYY-MM-DD */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  /** YYYY-MM-DD */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;
}
