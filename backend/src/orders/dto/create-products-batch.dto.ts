import {
  IsString,
  IsArray,
  IsOptional,
  IsNotEmpty,
  Matches,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductVariantBatchDto {
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
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'lastPrice يجب أن يكون رقماً غير سالب' })
  lastPrice?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:0*[1-9]\d*(?:\.\d{1,4})?|0*\.\d*[1-9]\d*)$/)
  quantityMultiplier?: string;
}

export class ProductRecipeBatchItemDto {
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

export class CreateProductItemDto {
  @IsNotEmpty()
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
  productType?: string; // 'order' | 'sale'

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sections?: string[];

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'lastPrice يجب أن يكون رقماً غير سالب' })
  lastPrice?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantBatchDto)
  variants?: ProductVariantBatchDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductRecipeBatchItemDto)
  recipe?: ProductRecipeBatchItemDto[];
}

export class CreateProductsBatchDto {
  @IsNotEmpty()
  @IsString()
  companyId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductItemDto)
  products: CreateProductItemDto[];
}
