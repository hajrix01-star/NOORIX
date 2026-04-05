import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

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
  notes?: string;
}
