import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const uploadDir = join(process.cwd(), 'uploads', 'hr-documents');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FinancialCoreModule } from '../financial-core/financial-core.module';
import { EmployeesModule } from '../employees/employees.module';
import { HRController } from './hr.controller';
import { HRService } from './hr.service';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const ext = (file.originalname || '').split('.').pop() || 'bin';
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    PrismaModule,
    AuditModule,
    FinancialCoreModule,
    EmployeesModule,
  ],
  controllers: [HRController],
  providers: [HRService],
  exports: [HRService],
})
export class HRModule {}
