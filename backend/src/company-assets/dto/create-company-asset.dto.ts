import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  notes?: string;
}
