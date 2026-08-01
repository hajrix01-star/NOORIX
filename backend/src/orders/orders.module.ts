import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersStaffService } from './orders-staff.service';
import { OrdersCatalogService } from './orders-catalog.service';
import { OrdersStaffReportService } from './orders-staff-report.service';
import { OrdersInventoryService } from './orders-inventory.service';
import { OrdersInventoryQualityService } from './orders-inventory-quality.service';
import { OrdersCatalogTranslationService } from './orders-catalog-translation.service';
import { OrdersCatalogProductIntegrityService } from './orders-catalog-product-integrity.service';
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
    OrdersCatalogProductIntegrityService,
    OrdersCatalogTranslationService,
    OrdersStaffReportService,
    OrdersInventoryService,
    OrdersInventoryQualityService,
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
