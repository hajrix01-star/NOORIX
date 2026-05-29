import { BadRequestException } from '@nestjs/common';
import type { ExtractInvoiceDto } from './dto/extract-invoice.dto';
import {
  mergeOcrImagePreprocessMeta,
  preprocessOcrImageForExtraction,
  type OcrPreprocessResult,
} from './ocr-image-preprocess.util';

export type PreparedOcrExtractionImage = {
  imageBase64: string;
  mimeType: string;
  preprocessResult: OcrPreprocessResult;
};

export async function prepareOcrExtractionImage(dto: ExtractInvoiceDto): Promise<PreparedOcrExtractionImage> {
  const mimeType = dto.mimeType || 'image/jpeg';
  try {
    const sourceBuffer = Buffer.from(dto.imageBase64, 'base64');
    const preprocessResult = await preprocessOcrImageForExtraction(sourceBuffer, mimeType);
    return {
      imageBase64: preprocessResult.buffer.toString('base64'),
      mimeType: preprocessResult.mimeType,
      preprocessResult,
    };
  } catch {
    throw new BadRequestException('صورة غير صالحة (تشفير base64).');
  }
}

export function attachOcrImagePreprocessMeta(
  payload: Record<string, unknown>,
  preprocessResult: OcrPreprocessResult | null,
): Record<string, unknown> {
  return preprocessResult ? mergeOcrImagePreprocessMeta(payload, preprocessResult) : payload;
}
