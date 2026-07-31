import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class PreviewProductTranslationsDto {
  @IsOptional()
  @IsString()
  @MaxLength(24)
  productType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ApplyProductTranslationItemDto {
  @IsString()
  @MaxLength(64)
  productId: string;

  @IsString()
  @MaxLength(80)
  nameEn: string;
}

export class ApplyProductTranslationsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ApplyProductTranslationItemDto)
  translations: ApplyProductTranslationItemDto[];
}

export class PreviewCategoryTranslationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ApplyCategoryTranslationItemDto {
  @IsString()
  @MaxLength(64)
  categoryId: string;

  @IsString()
  @MaxLength(80)
  nameEn: string;
}

export class ApplyCategoryTranslationsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ApplyCategoryTranslationItemDto)
  translations: ApplyCategoryTranslationItemDto[];
}
