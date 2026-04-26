import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

/** تعديل إعدادات نسخ النظام الافتراضية (كل الحقول اختياريّة) */
class SystemBackupConfigBaseDto {
  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  @Min(0)
  @Max(23)
  scheduleHour!: number;

  @IsInt()
  @Min(0)
  @Max(59)
  scheduleMinute!: number;

  @IsInt()
  @Min(1)
  @Max(50)
  retentionCount!: number;

  /** رابط تطبيق ويب Google Apps Script — فارغ لإلغاء الاعتماد على الحقل واستخدام متغير الخادم فقط */
  @IsString()
  @MaxLength(2048)
  gdriveScriptUrl!: string;

  /** معرّف مجلد Drive أو رابط المجلد — فارغ لإلغاء */
  @IsString()
  @MaxLength(512)
  gdriveFolderId!: string;
}

export class UpdateSystemBackupConfigDto extends PartialType(SystemBackupConfigBaseDto) {}
