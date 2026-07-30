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

  @IsOptional()
  @IsString()
  @Matches(/^(?:0*[1-9]\d*(?:\.\d{1,4})?|0*\.\d*[1-9]\d*)$/)
  quantityMultiplier?: string;
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
}
