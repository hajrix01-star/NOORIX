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

  /** تصنيف اختياري (مفتاح ثابت من الواجهة، مثل food_beverage) */
  @IsString()
  @IsOptional()
  @MaxLength(64, { message: 'تصنيف المورد يجب ألا يتجاوز 64 حرفاً' })
  supplierCategory?: string | null;

  /** مورد محاسبة Noorix — يُستخدم في اقتراحات فاتورة المشتريات */
  @IsOptional()
  @IsString()
  accountingSupplierId?: string | null;
}
