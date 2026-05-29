import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OcrIntakeService } from './ocr-intake.service';

/**
 * يعالج فواتير OCR العالقة في queued/extracting عند تعطل Redis أو Bull.
 */
@Injectable()
export class OcrExtractionSweeperService implements OnModuleInit {
  private readonly logger = new Logger(OcrExtractionSweeperService.name);
  private sweepRunning = false;

  constructor(private readonly intake: OcrIntakeService) {}

  onModuleInit(): void {
    void this.safeSweep('startup', 0);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronSweep(): Promise<void> {
    await this.safeSweep('cron');
  }

  private async safeSweep(source: string, minQueuedAgeSeconds?: number): Promise<void> {
    if (this.sweepRunning) return;
    this.sweepRunning = true;
    try {
      const requeued = await this.intake.recoverStuckExtractingInvoices();
      const processed = await this.intake.processStuckQueuedInvoices(8, minQueuedAgeSeconds);
      if (requeued || processed) {
        this.logger.warn(
          `OCR sweeper (${source}): requeued=${requeued}, processed=${processed}`,
        );
      }
    } catch (err) {
      this.logger.error(`OCR sweeper failed (${source}): ${(err as Error).message}`);
    } finally {
      this.sweepRunning = false;
    }
  }
}
