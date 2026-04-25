/** حالات سجل OCR من الإرسال حتى الاعتماد المحاسبي */
export const OcrInvoiceStatus = {
  QUEUED: 'queued',
  EXTRACTING: 'extracting',
  PENDING_REVIEW: 'pending_review',
  EXTRACTION_FAILED: 'extraction_failed',
  /** Legacy / مسار الرفع اليدوي القديم */
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
} as const;

export type OcrInvoiceStatusValue = (typeof OcrInvoiceStatus)[keyof typeof OcrInvoiceStatus];

export const OCR_REVIEW_QUEUE_STATUSES: OcrInvoiceStatusValue[] = [
  OcrInvoiceStatus.QUEUED,
  OcrInvoiceStatus.EXTRACTING,
  OcrInvoiceStatus.PENDING_REVIEW,
  OcrInvoiceStatus.EXTRACTION_FAILED,
];
