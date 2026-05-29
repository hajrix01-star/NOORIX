import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { OcrIntakeService } from './ocr-intake.service';
import { OCR_EXTRACTION_QUEUE } from './ocr-queue.constants';

const OCR_QUEUE_CONCURRENCY = Math.max(1, Number(process.env.OCR_QUEUE_CONCURRENCY || 1));

@Processor(OCR_EXTRACTION_QUEUE)
export class OcrExtractionProcessor {
  private readonly logger = new Logger(OcrExtractionProcessor.name);

  constructor(private readonly intake: OcrIntakeService) {}

  @Process({ name: 'run-extraction', concurrency: OCR_QUEUE_CONCURRENCY })
  async handleRunExtraction(job: Job<{ invoiceId: string }>): Promise<void> {
    const id = job.data?.invoiceId;
    if (!id) {
      this.logger.warn(`OCR job ${job.id}: missing invoiceId`);
      return;
    }
    await this.intake.runExtractionForInvoice(id);
  }
}
