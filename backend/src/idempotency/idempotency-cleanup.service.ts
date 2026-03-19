/**
 * IdempotencyCleanupService — تنظيف مفاتيح عدم التكرار المنتهية
 *
 * يُشغّل كل ساعة عبر Cron. يستخدم PrismaService (بدون tenant middleware)
 * لحذف السجلات المنتهية عبر جميع الـ tenants.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyCleanupService {
  private readonly logger = new Logger(IdempotencyCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Cron('0 * * * *', { name: 'idempotency-cleanup' })
  async handleCleanup() {
    try {
      const deleted = await this.idempotency.cleanupExpiredKeys(this.prisma);
      if (deleted > 0) {
        this.logger.log(`Idempotency cleanup: deleted ${deleted} expired key(s)`);
      }
    } catch (err) {
      this.logger.error('Idempotency cleanup failed', err instanceof Error ? err.stack : String(err));
    }
  }
}
