import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BackupService } from './backup.service';

/**
 * نسخ يومي كامل للقاعدة على القرص المحلي + رفع خارجي عند التفعيل.
 * يُفعَّل بـ BACKUP_DAILY_ENABLED=true على الخادم (ليس من الواجهة).
 */
@Injectable()
export class BackupSchedulerService {
  private readonly logger = new Logger(BackupSchedulerService.name);

  constructor(private readonly backupService: BackupService) {}

  @Cron('0 3 * * *')
  async handleDailyBackup(): Promise<void> {
    try {
      await this.backupService.runScheduledFullDatabaseBackup();
    } catch (e) {
      this.logger.error(`Daily backup scheduler error: ${(e as Error).message}`);
    }
  }
}
