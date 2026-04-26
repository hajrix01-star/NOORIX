import { IntersectionType, PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** نموذج بيانات الاستخدام الكامل (يُشتق منه DTO التعديل الجزئي فقط) */
class CompanyBackupConfigDataDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  @Min(0)
  @Max(23)
  @Type(() => Number)
  scheduleHour: number;

  @IsNumber()
  @Min(0)
  @Max(59)
  @Type(() => Number)
  scheduleMinute: number;

  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  retentionCount: number;

  @IsString()
  timezone: string;

  @IsString()
  @MaxLength(2048)
  gdriveScriptUrl: string;

  @IsString()
  @MaxLength(512)
  gdriveFolderId: string;
}

class CompanyBackupConfigCompanyIdBody {
  @IsString()
  companyId: string;
}

/**
 * باتش إعدادات نسخ الشركة — `companyId` في الجسم؛ باقي الحقول اختياريّة.
 */
export class UpdateCompanyBackupConfigDto extends IntersectionType(
  CompanyBackupConfigCompanyIdBody,
  PartialType(CompanyBackupConfigDataDto),
) {}
