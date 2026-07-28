import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupplierDirectoryController } from './supplier-directory.controller';
import { SupplierDirectoryService } from './supplier-directory.service';

@Module({
  imports: [AuthModule],
  controllers: [SupplierDirectoryController],
  providers: [SupplierDirectoryService],
  exports: [SupplierDirectoryService],
})
export class SupplierDirectoryModule {}
