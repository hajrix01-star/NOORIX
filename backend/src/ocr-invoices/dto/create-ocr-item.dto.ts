import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateOcrItemDto {
  @IsString()
  @IsNotEmpty()
  nameAr: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  unitType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;
}
