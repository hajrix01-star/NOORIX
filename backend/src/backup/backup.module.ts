import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { BackupSchedulerService } from './backup.scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [BackupController],
  providers: [BackupService, BackupSchedulerService],
  exports: [BackupService],
})
export class BackupModule {}
