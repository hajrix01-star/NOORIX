/** حالات فاتورة OCR في طابور المراجعة (من الخادم) */
export type OcrReviewInvoiceStatus =
  | 'queued'
  | 'extracting'
  | 'pending_review'
  | 'extraction_failed'
  | string;

export function isOcrReviewInProgress(status: OcrReviewInvoiceStatus | null | undefined): boolean {
  return status === 'queued' || status === 'extracting';
}
