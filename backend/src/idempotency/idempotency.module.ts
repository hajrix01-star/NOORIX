import { Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';

@Module({
  providers: [IdempotencyService, IdempotencyCleanupService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
