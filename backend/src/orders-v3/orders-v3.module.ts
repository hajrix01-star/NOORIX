import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersV3CatalogService } from './orders-v3-catalog.service';
import { OrdersV3Controller } from './orders-v3.controller';
import { OrdersV3DocumentsService } from './orders-v3-documents.service';
import { OrdersV3InventoryService } from './orders-v3-inventory.service';
import { OrdersV3LedgerPostingService } from './orders-v3-ledger-posting.service';
import { OrdersV3ReportsService } from './orders-v3-reports.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrdersV3Controller],
  providers: [OrdersV3CatalogService, OrdersV3DocumentsService, OrdersV3InventoryService, OrdersV3LedgerPostingService, OrdersV3ReportsService],
  exports: [OrdersV3CatalogService, OrdersV3DocumentsService, OrdersV3InventoryService, OrdersV3ReportsService],
})
export class OrdersV3Module {}
