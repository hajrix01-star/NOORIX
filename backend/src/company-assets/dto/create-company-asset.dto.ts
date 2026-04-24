import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WarrantyLineDto } from './warranty-line.dto';

export class CreateCompanyAssetDto {
  @IsString()
  companyId: string;

  @IsString()
  nameAr: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  location?: string;

  /** YYYY-MM-DD */
  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999_999_999.99)
  acquisitionCost?: number;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  warrantyDescription?: string;

  /** مدة الضمان بالأشهر (تُستخدم مع تاريخ البداية لحساب نهاية الضمان إن لم تُحدَّد نهاية صريحة) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  warrantyMonths?: number;

  /** YYYY-MM-DD */
  @IsOptional()
  @IsString()
  warrantyStartDate?: string;

  /** YYYY-MM-DD — إن وُجدت تُستخدم كما هي ولا تُحسب من الأشهر */
  @IsOptional()
  @IsString()
  warrantyEndDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;

  /** بنود تفصيل ضمان (من قسم الضمان) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WarrantyLineDto)
  warrantyLines?: WarrantyLineDto[];
}
