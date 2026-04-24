import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  ValidateNested,
  ArrayMinSize,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  packaging?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'الكمية يجب أن تكون رقماً موجباً' })
  quantity: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'سعر الوحدة يجب أن يكون رقماً غير سالب' })
  unitPrice: string;
}

export class CreateOrderDto {
  @IsString()
  companyId: string;

  @IsString()
  orderDate: string;

  @IsIn(['external', 'internal'])
  orderType: 'external' | 'internal';

  @IsOptional()
  @IsString()
  pettyCashAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'يجب إدخال صنف واحد على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
