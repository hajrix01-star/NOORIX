import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { Module }            from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule }      from '../prisma/prisma.module';
import { AuthModule }        from '../auth/auth.module';
import { AuditModule }       from '../audit/audit.module';
import { ensureUploadsSubdir } from '../common/uploads-root';
import { EmployeesController } from './employees.controller';
import { EmployeesService }    from './employees.service';

const employeePhotosDir = ensureUploadsSubdir('employee-photos');

@Module({
  imports:     [
    MulterModule.register({
      storage: diskStorage({
        destination: employeePhotosDir,
        filename: (_req, file, cb) => {
          const rawExt = (file.originalname || '').split('.').pop() || 'img';
          const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'img';
          cb(null, `employee-photo-${randomUUID()}.${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
    PrismaModule,
    AuthModule,
    AuditModule,
  ],
  controllers: [EmployeesController],
  providers:   [EmployeesService],
  exports:     [EmployeesService],
})
export class EmployeesModule {}
