import { IsString, Matches } from 'class-validator';

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Read-only accounting reconciliation period. */
export class DashboardLedgerReconciliationQueryDto {
  @IsString()
  companyId: string;

  @IsString()
  @Matches(YMD_PATTERN)
  startDate: string;

  @IsString()
  @Matches(YMD_PATTERN)
  endDate: string;
}
