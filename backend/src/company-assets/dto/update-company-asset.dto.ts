import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCompanyAssetDto {
  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  location?: string;

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  warrantyMonths?: number;

  @IsOptional()
  @IsString()
  warrantyStartDate?: string;

  @IsOptional()
  @IsString()
  warrantyEndDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
