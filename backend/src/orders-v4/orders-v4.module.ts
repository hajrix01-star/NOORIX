import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersV4CatalogService } from './orders-v4-catalog.service';
import { OrdersV4Controller } from './orders-v4.controller';
import { OrdersV4DocumentsService } from './orders-v4-documents.service';
import { OrdersV4FundsPostingService } from './orders-v4-funds-posting.service';
import { OrdersV4InventoryService } from './orders-v4-inventory.service';
import { OrdersV4ItemDefinitionService } from './orders-v4-item-definition.service';
import { OrdersV4LedgerPostingService } from './orders-v4-ledger-posting.service';
import { OrdersV4LegacyCutoverService } from './orders-v4-legacy-cutover.service';
import { OrdersV4LegacyCutoverImportService } from './orders-v4-legacy-cutover-import.service';
import { OrdersV4ReportsService } from './orders-v4-reports.service';

@Module({
  imports: [PrismaModule, AuthModule, OrdersModule],
  controllers: [OrdersV4Controller],
  providers: [OrdersV4CatalogService, OrdersV4DocumentsService, OrdersV4FundsPostingService, OrdersV4InventoryService, OrdersV4ItemDefinitionService, OrdersV4LedgerPostingService, OrdersV4LegacyCutoverService, OrdersV4LegacyCutoverImportService, OrdersV4ReportsService],
  exports: [OrdersV4CatalogService, OrdersV4DocumentsService, OrdersV4InventoryService, OrdersV4ReportsService],
})
export class OrdersV4Module {}
