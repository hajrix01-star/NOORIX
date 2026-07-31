import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  INVENTORY_QUANTITY_PATTERN,
  INVENTORY_RECORD_ID_PATTERN,
} from '../orders-inventory-stocktake.util';

export class CreateInventoryStocktakeLineDto {
  @IsString()
  @Matches(INVENTORY_RECORD_ID_PATTERN, { message: 'معرف صنف الجرد غير صالح' })
  productId: string;

  @IsString()
  @Matches(INVENTORY_QUANTITY_PATTERN, {
    message: 'الكمية الفعلية يجب أن تكون غير سالبة وبحد أقصى 6 منازل عشرية',
  })
  physicalQuantity: string;
}

export class CreateInventoryStocktakeDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاريخ الجرد يجب أن يكون بصيغة YYYY-MM-DD' })
  stocktakeDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryStocktakeLineDto)
  lines: CreateInventoryStocktakeLineDto[];
}
