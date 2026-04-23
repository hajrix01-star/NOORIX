import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateSystemBackupConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  scheduleHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  scheduleMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  retentionCount?: number;

  /** رابط تطبيق ويب Google Apps Script — فارغ لإلغاء الاعتماد على الحقل واستخدام متغير الخادم فقط */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  gdriveScriptUrl?: string;

  /** معرّف مجلد Drive أو رابط المجلد — فارغ لإلغاء */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  gdriveFolderId?: string;
}
