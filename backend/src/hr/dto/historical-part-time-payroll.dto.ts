import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class CreateHistoricalPartTimePayrollLinkDto {
  @IsString()
  @MaxLength(100)
  ledgerEntryId!: string;

  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  targetMonth!: string;

  @IsString()
  @IsIn(['LINK_HISTORICAL_PART_TIME_PAYROLL'])
  confirmation!: 'LINK_HISTORICAL_PART_TIME_PAYROLL';
}
