import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateOcrSupplierDto {
  @IsString()
  @IsNotEmpty()
  nameAr: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsString()
  @IsOptional()
  taxNumber?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;
}
