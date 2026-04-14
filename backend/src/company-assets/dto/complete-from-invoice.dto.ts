import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WarrantyLineDto } from './warranty-line.dto';

/**
 * إكمال بيانات الضمان لفاتورة مشتريات كانت مُفعَّلة «متابعة ضمان» — المدة تُسجَّل هنا فقط.
 */
export class CompleteCompanyAssetFromInvoiceDto {
  @IsString()
  companyId: string;

  @IsString()
  invoiceId: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WarrantyLineDto)
  warrantyLines?: WarrantyLineDto[];

  /** عند true (افتراضي): تُخرج الفاتورة من قائمة انتظار الضمان */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  markInvoiceDone?: boolean;
}
