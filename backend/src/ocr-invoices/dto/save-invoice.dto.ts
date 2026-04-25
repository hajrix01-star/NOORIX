import { IsString, IsOptional, IsArray, IsNumber, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { OcrFinalizePurchaseDto } from './ocr-finalize-purchase.dto';

export class SaveInvoiceLineDto {
  @IsString()
  rawName: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  sizeUnit?: string;

  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  totalPrice?: number;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsString()
  matchStatus?: string;
}

export class SaveInvoiceDto {
  /** عند التأكيد من شاشة المراجعة — تحديث نفس السجل بدل إنشاء جديد */
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  /** اسم المورد كما استخرجه OCR — يُستخدم لإنشاء مورد جديد إذا لم يكن هناك supplierId */
  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @IsOptional()
  @IsNumber()
  subtotalAmount?: number;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @IsOptional()
  @IsNumber()
  vatAmount?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  rawExtraction?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveInvoiceLineDto)
  lines: SaveInvoiceLineDto[];

  /** فقط مع `id` (اعتماد من المراجعة) — إنشاء فاتورة مشتريات وربطها */
  @IsOptional()
  @ValidateNested()
  @Type(() => OcrFinalizePurchaseDto)
  purchase?: OcrFinalizePurchaseDto;
}
