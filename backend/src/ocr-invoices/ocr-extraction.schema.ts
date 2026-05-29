import { z } from 'zod';
import type { GeminiExtractedInvoice } from './ocr-gemini-extract.constants';

const confidenceSchema = z.number().min(0).max(1).optional();
const numberValueSchema = z.number().finite();
const nonEmptyStringSchema = z.string().trim().min(1);

const textWithConfidenceSchema = z
  .object({
    value: nonEmptyStringSchema.optional(),
    confidence: confidenceSchema,
  })
  .strict()
  .optional();

const numberWithConfidenceSchema = z
  .object({
    value: numberValueSchema.optional(),
    confidence: confidenceSchema,
  })
  .strict()
  .optional();

const extractedItemSchema = z
  .object({
    name: nonEmptyStringSchema,
    quantity: numberValueSchema.optional(),
    unitPrice: numberValueSchema.optional(),
    totalPrice: numberValueSchema.optional(),
    confidence: confidenceSchema,
    nameAr: nonEmptyStringSchema.optional(),
    nameEn: nonEmptyStringSchema.optional(),
    size: nonEmptyStringSchema.optional(),
    sizeUnit: nonEmptyStringSchema.optional(),
    cleanName: nonEmptyStringSchema.optional(),
  })
  .strict();

export const ocrExtractionSchema = z
  .object({
    supplier: z
      .object({
        name: nonEmptyStringSchema.optional(),
        confidence: confidenceSchema,
      })
      .strict()
      .optional(),
    vatNumber: textWithConfidenceSchema,
    invoiceNumber: textWithConfidenceSchema,
    invoiceDate: textWithConfidenceSchema,
    subtotalAmount: numberWithConfidenceSchema,
    totalAmount: numberWithConfidenceSchema,
    vatAmount: numberWithConfidenceSchema,
    items: z.array(extractedItemSchema).default([]),
  })
  .strict();

export type ValidatedOcrExtraction = z.infer<typeof ocrExtractionSchema>;

export function validateOcrExtractionWithZod(payload: unknown): {
  success: true;
  data: GeminiExtractedInvoice;
} | {
  success: false;
  issues: string[];
} {
  const parsed = ocrExtractionSchema.safeParse(payload);
  if (parsed.success) {
    return { success: true, data: parsed.data as GeminiExtractedInvoice };
  }
  return {
    success: false,
    issues: parsed.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    }),
  };
}
