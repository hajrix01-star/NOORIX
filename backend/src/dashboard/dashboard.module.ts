import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportsModule } from '../reports/reports.module';
import { SalesModule } from '../sales/sales.module';
import { ReportingModule } from '../reporting/reporting.module';
import { VaultsModule } from '../vaults/vaults.module';
import { DashboardCalendarService } from './dashboard-calendar.service';
import { DashboardController } from './dashboard.controller';
import { DashboardLedgerProjectionService } from './dashboard-ledger-projection.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, ReportsModule, SalesModule, ReportingModule, VaultsModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardCalendarService, DashboardLedgerProjectionService],
})
export class DashboardModule {}
