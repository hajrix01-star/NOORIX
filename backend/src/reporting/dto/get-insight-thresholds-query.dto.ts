import { IsString } from 'class-validator';

/** GET /reporting/insights/thresholds — company context required for guard + storage lookup */
export class GetInsightThresholdsQueryDto {
  @IsString()
  companyId: string;
}
