import { IsOptional, IsString, MinLength } from 'class-validator';

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
}
