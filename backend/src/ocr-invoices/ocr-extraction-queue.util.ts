/** خيارات Bull المشتركة لمهمة run-extraction */
export const OCR_EXTRACTION_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 200,
  removeOnFail: 100,
};

export function ocrUseInlineExtraction(): boolean {
  return String(process.env.OCR_INLINE_EXTRACTION || '').trim().toLowerCase() === 'true';
}

export function ocrQueueStuckAfterSeconds(): number {
  const n = Number(process.env.OCR_QUEUE_STUCK_SECONDS || 60);
  return Number.isFinite(n) ? Math.max(15, Math.floor(n)) : 60;
}

export function ocrExtractingStuckAfterMinutes(): number {
  const n = Number(process.env.OCR_EXTRACTING_STUCK_MINUTES || 15);
  return Number.isFinite(n) ? Math.max(5, Math.floor(n)) : 15;
}
