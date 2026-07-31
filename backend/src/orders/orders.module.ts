import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersStaffService } from './orders-staff.service';
import { OrdersCatalogService } from './orders-catalog.service';
import { OrdersStaffReportService } from './orders-staff-report.service';
import { OrdersInventoryService } from './orders-inventory.service';
import { OrdersCatalogTranslationService } from './orders-catalog-translation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [PrismaModule, AuthModule, ChatModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersStaffService,
    OrdersCatalogService,
    OrdersCatalogTranslationService,
    OrdersStaffReportService,
    OrdersInventoryService,
  ],
  exports: [
    OrdersService,
    OrdersStaffService,
    OrdersCatalogService,
    OrdersCatalogTranslationService,
    OrdersStaffReportService,
    OrdersInventoryService,
  ],
})
export class OrdersModule {}
