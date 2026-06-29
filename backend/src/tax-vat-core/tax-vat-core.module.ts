import { Module } from '@nestjs/common';
import { TaxVatCoreService } from './tax-vat-core.service';

@Module({
  providers: [TaxVatCoreService],
  exports: [TaxVatCoreService],
})
export class TaxVatCoreModule {}
