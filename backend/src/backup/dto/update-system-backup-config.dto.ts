import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

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
}
