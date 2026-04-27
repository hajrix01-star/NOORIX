import { Module }               from '@nestjs/common';
import { MulterModule }         from '@nestjs/platform-express';
import { diskStorage }          from 'multer';
import { AuthModule }           from '../auth/auth.module';
import { AuditModule }          from '../audit/audit.module';
import { FinancialCoreModule }  from '../financial-core/financial-core.module';
import { VaultsModule }         from '../vaults/vaults.module';
import { InvoiceController }    from './invoice.controller';
import { InvoiceService }       from './invoice.service';
import { ensureUploadsSubdir } from '../common/uploads-root';

const invoiceAttachDir = ensureUploadsSubdir('invoice-attachments');

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: invoiceAttachDir,
        filename: (_req, file, cb) => {
          const ext = (file.originalname || '').split('.').pop() || 'bin';
          cb(null, `inv-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    AuthModule,
    AuditModule,
    FinancialCoreModule,
    VaultsModule,
  ],
  controllers: [InvoiceController],
  providers:   [InvoiceService],
  exports:     [InvoiceService],
})
export class InvoiceModule {}
