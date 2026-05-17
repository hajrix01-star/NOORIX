import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportsModule } from '../reports/reports.module';
import { SalesModule } from '../sales/sales.module';
import { OwnerController } from './owner.controller';
import { OwnerService } from './owner.service';

@Module({
  imports: [AuthModule, ReportsModule, SalesModule],
  controllers: [OwnerController],
  providers: [OwnerService],
})
export class OwnerModule {}
