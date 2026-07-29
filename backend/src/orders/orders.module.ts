import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { ShishaInventoryController } from './shisha-inventory.controller';
import { OrdersService } from './orders.service';
import { OrdersStaffService } from './orders-staff.service';
import { ShishaInventoryService } from './shisha-inventory.service';
import { OrdersCatalogService } from './orders-catalog.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrdersController, ShishaInventoryController],
  providers: [OrdersService, OrdersStaffService, ShishaInventoryService, OrdersCatalogService],
  exports: [OrdersService, OrdersStaffService, ShishaInventoryService, OrdersCatalogService],
})
export class OrdersModule {}
