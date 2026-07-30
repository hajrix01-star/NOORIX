import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { ShishaInventoryController } from './shisha-inventory.controller';
import { OrdersService } from './orders.service';
import { OrdersStaffService } from './orders-staff.service';
import { ShishaInventoryService } from './shisha-inventory.service';
import { ShishaInventorySourceService } from './shisha-inventory-source.service';
import { OrdersCatalogService } from './orders-catalog.service';
import { OrdersStaffDigestService } from './orders-staff-digest.service';
import { OrdersStaffReportService } from './orders-staff-report.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrdersController, ShishaInventoryController],
  providers: [
    OrdersService,
    OrdersStaffService,
    ShishaInventoryService,
    ShishaInventorySourceService,
    OrdersCatalogService,
    OrdersStaffDigestService,
    OrdersStaffReportService,
  ],
  exports: [
    OrdersService,
    OrdersStaffService,
    ShishaInventoryService,
    OrdersCatalogService,
    OrdersStaffDigestService,
    OrdersStaffReportService,
  ],
})
export class OrdersModule {}
