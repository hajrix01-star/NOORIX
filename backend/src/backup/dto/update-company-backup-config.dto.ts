import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateCompanyBackupConfigDto {
  @IsString()
  companyId!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(23)
  scheduleHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(59)
  scheduleMinute?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  retentionCount?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  gdriveScriptUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  gdriveFolderId?: string;
}
