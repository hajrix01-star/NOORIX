import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersStaffController } from './orders-staff.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrdersController, OrdersStaffController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
