import { IsOptional, IsString, MinLength, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class ImportBackupDto {
  @IsString()
  @MinLength(8)
  jobId!: string;

  @IsString()
  @MinLength(2)
  nameAr!: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  /** إن true: فشل الاستيراد وتراجع كامل عند أي تعارض بين مجموع توزيعات الخزائن وإجمالي الفاتورة */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  failOnAllocationWarnings?: boolean;
}
