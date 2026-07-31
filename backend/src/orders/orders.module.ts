import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersStaffService } from './orders-staff.service';
import { OrdersCatalogService } from './orders-catalog.service';
import { OrdersStaffReportService } from './orders-staff-report.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersStaffService,
    OrdersCatalogService,
    OrdersStaffReportService,
  ],
  exports: [
    OrdersService,
    OrdersStaffService,
    OrdersCatalogService,
    OrdersStaffReportService,
  ],
})
export class OrdersModule {}
