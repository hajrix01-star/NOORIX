import {
  ocrExtractingStuckAfterMinutes,
  ocrQueueStuckAfterSeconds,
  ocrUseInlineExtraction,
} from './ocr-extraction-queue.util';

describe('ocr-extraction-queue util', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterAll(() => {
    process.env = env;
  });

  it('reads inline extraction flag', () => {
    process.env.OCR_INLINE_EXTRACTION = 'true';
    expect(ocrUseInlineExtraction()).toBe(true);
    process.env.OCR_INLINE_EXTRACTION = 'false';
    expect(ocrUseInlineExtraction()).toBe(false);
  });

  it('clamps stuck thresholds', () => {
    process.env.OCR_QUEUE_STUCK_SECONDS = '10';
    expect(ocrQueueStuckAfterSeconds()).toBe(15);
    process.env.OCR_EXTRACTING_STUCK_MINUTES = '2';
    expect(ocrExtractingStuckAfterMinutes()).toBe(5);
  });
});
