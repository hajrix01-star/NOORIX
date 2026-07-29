import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { ShishaInventoryController } from './shisha-inventory.controller';
import { OrdersService } from './orders.service';
import { OrdersStaffService } from './orders-staff.service';
import { ShishaInventoryService } from './shisha-inventory.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrdersController, ShishaInventoryController],
  providers: [OrdersService, OrdersStaffService, ShishaInventoryService],
  exports: [OrdersService, OrdersStaffService, ShishaInventoryService],
})
export class OrdersModule {}
