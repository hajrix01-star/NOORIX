import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

/** رفع فاتورة للاستخراج في الخلفية — base64 كما في مسار الاستخراج الحالي */
export class SubmitOcrInvoiceDto {
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  mimeType?: string;
}
