import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportsModule } from '../reports/reports.module';
import { SalesModule } from '../sales/sales.module';
import { OwnerController } from './owner.controller';
import { OwnerAdminDashboardController } from './owner-admin-dashboard.controller';
import { OwnerAdminDashboardService } from './owner-admin-dashboard.service';
import { OwnerService } from './owner.service';
import { AdminDashboardTokenGuard } from './admin-dashboard-token.guard';

@Module({
  imports: [AuthModule, ReportsModule, SalesModule],
  controllers: [OwnerController, OwnerAdminDashboardController],
  providers: [OwnerService, OwnerAdminDashboardService, AdminDashboardTokenGuard],
})
export class OwnerModule {}
