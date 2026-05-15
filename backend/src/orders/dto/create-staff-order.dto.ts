import {
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStaffOrderItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customLabelAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customLabelEn?: string;

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

export class CreateStaffOrderDto {
  @IsString()
  companyId: string;

  @IsString()
  orderDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'يجب إدخال صنف واحد على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => CreateStaffOrderItemDto)
  items: CreateStaffOrderItemDto[];
}

export class UpdateStaffOrderDto {
  @IsOptional()
  @IsString()
  orderDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'يجب إدخال صنف واحد على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => CreateStaffOrderItemDto)
  items: CreateStaffOrderItemDto[];
}

export class MarkStaffDigestDto {
  @IsString()
  companyId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderIds: string[];
}
