import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  ValidateNested,
  ArrayMinSize,
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
  quantity: string;

  @IsString()
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
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'يجب إدخال صنف واحد على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
