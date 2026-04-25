import { IsString, IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

/** عند اعتماد فاتورة OCR — إنشاء فاتورة مشتريات محاسبية وربطها */
export class OcrFinalizePurchaseDto {
  @IsString()
  accountingSupplierId: string;

  /** تاريخ التسجيل المحاسبي (قابل للتعديل) — يختلف عن تاريخ فاتورة المورد */
  @IsDateString()
  transactionDate: string;

  @IsString()
  vaultId: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isTaxable?: boolean;

  /** إن لم يُمرَّر يُؤخذ من رقم الفاتورة في سجل OCR */
  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;
}
