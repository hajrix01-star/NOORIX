import { Module } from '@nestjs/common';
import { CompanyAssetsController } from './company-assets.controller';
import { CompanyAssetsService } from './company-assets.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CompanyAssetsController],
  providers: [CompanyAssetsService],
  exports: [CompanyAssetsService],
})
export class CompanyAssetsModule {}
