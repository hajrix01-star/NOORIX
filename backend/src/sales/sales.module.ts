import { Module }              from '@nestjs/common';
import { PrismaModule }        from '../prisma/prisma.module';
import { AuthModule }          from '../auth/auth.module';
import { FinancialCoreModule } from '../financial-core/financial-core.module';
import { SalesController }     from './sales.controller';
import { SalesService }        from './sales.service';
import { SalesDashboardPackService } from './sales-dashboard-pack.service';

@Module({
  imports:     [PrismaModule, AuthModule, FinancialCoreModule],
  controllers: [SalesController],
  providers:   [SalesService, SalesDashboardPackService],
  exports:     [SalesService],
})
export class SalesModule {}
