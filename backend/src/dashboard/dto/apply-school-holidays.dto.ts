import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ApplySchoolHolidaysDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @IsOptional()
  @IsIn(['general', 'western'])
  variant?: 'general' | 'western';

  @IsArray()
  @IsString({ each: true })
  eventIds!: string[];

  @IsIn(['company', 'tenant'])
  scope!: 'company' | 'tenant';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companyIds?: string[];

  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en';
}
