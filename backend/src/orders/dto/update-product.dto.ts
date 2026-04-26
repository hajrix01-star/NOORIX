import { IntersectionType, OmitType, PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductDto } from './create-product.dto';

class UpdateProductActiveField {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

/**
 * تعديل صنف — كل الحقول اختيارية؛ companyId ليس جزءاً من جسم التعديل.
 * `isActive` ليس في Create (الإنشاء يستند لافتراض قاعدة البيانات).
 */
export class UpdateProductDto extends IntersectionType(
  PartialType(OmitType(CreateProductDto, ['companyId'] as const)),
  UpdateProductActiveField,
) {}
