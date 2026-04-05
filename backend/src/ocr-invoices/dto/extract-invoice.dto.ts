import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class ExtractInvoiceDto {
  @IsString()
  @IsNotEmpty()
  imageBase64: string; // base64 encoded image

  @IsString()
  @IsOptional()
  mimeType?: string; // image/jpeg | image/png | image/webp
}
