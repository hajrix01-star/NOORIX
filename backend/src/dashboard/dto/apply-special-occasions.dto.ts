import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class ApplySpecialOccasionsDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @IsArray()
  @IsString({ each: true })
  occasionIds!: string[];

  @IsIn(['company', 'tenant'])
  scope!: 'company' | 'tenant';

  /** عند scope=tenant: قائمة شركات المستأجر (يُتحقق منها على الخادم) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companyIds?: string[];

  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en';

  /** إزاحة بالأيام لكل مناسبة (مفتاح = id المناسبة، قيمة -3..3) */
  @IsOptional()
  @IsObject()
  dayShifts?: Record<string, number>;
}
