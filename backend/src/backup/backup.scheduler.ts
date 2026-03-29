import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackupService } from './backup.service';

/**
 * يتحقق كل دقيقة من إعدادات النسخ التلقائي (جدول system_backup_config):
 * التوقيت بتوقيت الرياض (أو timezone المخزّن)، الاحتفاظ بآخر N نسخة، إلخ.
 */
@Injectable()
export class BackupSchedulerService {
  private readonly logger = new Logger(BackupSchedulerService.name);

  constructor(private readonly backupService: BackupService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledBackupTick(): Promise<void> {
    try {
      await this.backupService.runScheduledFullDatabaseBackup();
    } catch (e) {
      this.logger.error(`Backup scheduler tick error: ${(e as Error).message}`);
    }
  }
}
