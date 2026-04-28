import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { SalesModule } from '../sales/sales.module';
import { ReportingFacade } from './reporting.facade';

/**
 * Registers {@link ReportingFacade} for dependency injection. No HTTP surface.
 */
@Module({
  imports: [ReportsModule, SalesModule],
  providers: [ReportingFacade],
  exports: [ReportingFacade],
})
export class ReportingModule {}
