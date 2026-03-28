import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { BackupSchedulerService } from './backup.scheduler';
import { BackupLogicalImportService } from './backup-logical-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [BackupController],
  providers: [BackupService, BackupSchedulerService, BackupLogicalImportService],
  exports: [BackupService],
})
export class BackupModule {}
