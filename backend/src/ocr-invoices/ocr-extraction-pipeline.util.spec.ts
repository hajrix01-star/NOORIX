import {
  applyMathValidation,
  hasMeaningfulExtractionPayload,
  isActionableExtractionPayload,
  summarizeExtractionSignal,
} from './ocr-extraction-pipeline.util';
import type { GeminiExtractedInvoice } from './ocr-gemini-extract.constants';

describe('ocr-extraction-pipeline signal guards', () => {
  it('marks supplier-only extraction as meaningful but not actionable', () => {
    const payload: GeminiExtractedInvoice = {
      supplier: { name: 'AL HAJRI', confidence: 0.9 },
      items: [],
    };
    expect(hasMeaningfulExtractionPayload(payload)).toBe(true);
    expect(isActionableExtractionPayload(payload)).toBe(false);
  });

  it('marks extraction with financial totals as actionable', () => {
    const payload: GeminiExtractedInvoice = {
      supplier: { name: 'AL HAJRI', confidence: 0.92 },
      totalAmount: { value: 2752.02, confidence: 0.98 },
      vatAmount: { value: 358.96, confidence: 0.97 },
      items: [],
    };
    expect(hasMeaningfulExtractionPayload(payload)).toBe(true);
    expect(isActionableExtractionPayload(payload)).toBe(true);
  });

  it('marks extraction with supplier plus invoice reference as non-actionable', () => {
    const payload: GeminiExtractedInvoice = {
      supplier: { name: 'AL HAJRI', confidence: 0.88 },
      invoiceNumber: { value: 'INV-2026-1008', confidence: 0.7 },
      items: [],
    };
    const summary = summarizeExtractionSignal(payload);
    expect(summary.hasMeaningful).toBe(true);
    expect(summary.actionable).toBe(false);
  });

  it('marks supplier plus VAT number only as non-actionable', () => {
    const payload: GeminiExtractedInvoice = {
      supplier: { name: 'شركة ركن على هواك التجارية', confidence: 0.86 },
      vatNumber: { value: '311354068000003', confidence: 0.91 },
      items: [],
    };
    const summary = summarizeExtractionSignal(payload);
    expect(summary.hasMeaningful).toBe(true);
    expect(summary.actionable).toBe(false);
  });

  it('marks extraction with line items as actionable', () => {
    const payload: GeminiExtractedInvoice = {
      items: [
        { name: 'ALMARAI MILK FULL FAT 12*1LTR', quantity: 2, totalPrice: 23 },
      ],
    };
    const summary = summarizeExtractionSignal(payload);
    expect(summary.itemSignalCount).toBe(1);
    expect(summary.actionable).toBe(true);
  });

  it('auto-reconciles inclusive line unit price when OCR mixes net unit and gross total', () => {
    const payload: GeminiExtractedInvoice = {
      subtotalAmount: { value: 1478.26, confidence: 0.9 },
      vatAmount: { value: 221.74, confidence: 0.9 },
      totalAmount: { value: 1700, confidence: 0.95 },
      items: [
        {
          name: 'تفاحتين الفاخر 500 جرام',
          quantity: 1,
          unitPrice: 1478.26,
          totalPrice: 1699.999,
          confidence: 0.9,
        },
      ],
    };
    const result = applyMathValidation(payload);
    expect(result.lineTaxMode).toBe('inclusive');
    expect(result.items[0].unitPrice).toBe(1700);
    expect(result.items[0].mathWarning).toBeUndefined();
  });
});
