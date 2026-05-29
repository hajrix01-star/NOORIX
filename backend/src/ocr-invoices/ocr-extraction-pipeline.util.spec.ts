import {
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

  it('marks extraction with supplier plus invoice reference as actionable', () => {
    const payload: GeminiExtractedInvoice = {
      supplier: { name: 'AL HAJRI', confidence: 0.88 },
      invoiceNumber: { value: 'INV-2026-1008', confidence: 0.7 },
      items: [],
    };
    const summary = summarizeExtractionSignal(payload);
    expect(summary.hasMeaningful).toBe(true);
    expect(summary.actionable).toBe(true);
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
});
