import { IsString } from 'class-validator';

export class ResetInsightThresholdsDto {
  @IsString()
  companyId: string;
}
