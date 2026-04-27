import { IsOptional, IsString, Matches } from 'class-validator';

/** استعلام Analytics Studio — تواريخ YMD، وشركة واحدة اختيارية (بدونها = كل الشركات المسموحة للمستخدم). */
export class AnalyticsStudioQueryDto {
  /** YYYY-MM-DD */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  /** YYYY-MM-DD */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;

  /** إن وُجدت، يُقيَّد التحليل بهذه الشركة بعد التحقق من الصلاحية. */
  @IsOptional()
  @IsString()
  companyId?: string;
}
