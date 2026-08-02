import { IsString, IsOptional, IsArray, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductVariantDto {
  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  packaging?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  lastPrice?: string;

}

export class ProductRecipeItemDto {
  @IsOptional()
  @IsString()
  materialType?: string;

  @IsOptional()
  @IsString()
  materialProductId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:0*[1-9]\d*(?:\.\d{1,4})?|0*\.\d*[1-9]\d*)$/)
  quantity?: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class ProductUnitConversionDto {
  @IsOptional()
  @IsString()
  fromUnit?: string;

  @IsOptional()
  @IsString()
  toUnit?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:0*[1-9]\d*(?:\.\d{1,4})?|0*\.\d*[1-9]\d*)$/)
  multiplier?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class CreateProductDto {
  @IsString()
  companyId: string;

  @IsString()
  nameAr: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  sizes?: string;

  @IsOptional()
  @IsString()
  packaging?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  lastPrice?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sections?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionIds?: string[];

  @IsOptional()
  @IsString()
  productType?: string;  // 'order' | 'sale'

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductUnitConversionDto)
  inventoryConversions?: ProductUnitConversionDto[];

  @IsOptional()
  @IsString()
  conversionTemplateId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductRecipeItemDto)
  recipe?: ProductRecipeItemDto[];
}
