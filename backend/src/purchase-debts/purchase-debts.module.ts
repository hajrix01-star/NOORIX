import { Module } from '@nestjs/common';
import { PurchaseDebtsController } from './purchase-debts.controller';
import { PurchaseDebtsService } from './purchase-debts.service';

@Module({
  controllers: [PurchaseDebtsController],
  providers: [PurchaseDebtsService],
})
export class PurchaseDebtsModule {}
