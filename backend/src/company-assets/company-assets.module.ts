import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CompanyAssetsController } from './company-assets.controller';
import { CompanyAssetsService } from './company-assets.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ensureUploadsSubdir } from '../common/uploads-root';

const assetWarrantyAttachDir = ensureUploadsSubdir('asset-warranty-attachments');

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: assetWarrantyAttachDir,
        filename: (_req, file, cb) => {
          const rawExt = (file.originalname || '').split('.').pop() || 'img';
          const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'img';
          cb(null, `asset-warranty-${randomUUID()}.${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [CompanyAssetsController],
  providers: [CompanyAssetsService],
  exports: [CompanyAssetsService],
})
export class CompanyAssetsModule {}
