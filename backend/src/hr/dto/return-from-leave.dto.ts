import { IsOptional, IsDateString } from 'class-validator';

/** تاريخ العودة الفعلي (يوم تقويمي). إن وُجد قبل نهاية الإجازة المسجّلة تُقصّر الإجازة. */
export class ReturnFromLeaveDto {
  @IsOptional()
  @IsDateString()
  actualReturnDate?: string;
}
